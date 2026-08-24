#!/usr/bin/env python3
"""
Teste le bind AD et la correspondance identité→technicien pour karavundoboard.

Sans dépendance : parle LDAP en direct, rien à installer (ni ldapsearch, ni
python-ldap). À lancer depuis n'importe quelle machine qui joint un DC en 636.

  MDP='...' python3 scripts/test-ad-bind.py
  python3 scripts/test-ad-bind.py            # demande le mot de passe sans l'afficher

Variables (toutes optionnelles, valeurs par défaut ci-dessous) :
  DC, BASE_DN, BIND_USER, MDP, LOGINS
"""
import os, re, socket, ssl, sys, getpass

DC        = os.environ.get('DC', 'ad02.in.karavel.com')
BASE_DN   = os.environ.get('BASE_DN', 'DC=in,DC=karavel,DC=com')
BIND_USER = os.environ.get('BIND_USER', 'cs-karinventaire@in.karavel.com')
# Les identifiants attendus, tirés de src/lib/technicians.ts
LOGINS    = os.environ.get('LOGINS', 'nehad,zkarroum,maabid,cananthakumar,rrinville,blouis,ext-favundo').split(',')
# Groupes d'accès à vérifier. L'orthographe doit être EXACTE : Authelia compare
# les cn littéralement, une lettre de travers = « accès refusé » sans explication.
GROUPES   = [g for g in os.environ.get('GROUPES', 'karinventaire-tech,karinvetaire-admin,karinventaire-admin').split(',') if g]

# ─── encodage BER ────────────────────────────────────────────────────────────
def L(b):
    n = len(b)
    if n < 128: return bytes([n])
    w = (n.bit_length() + 7) // 8
    return bytes([0x80 | w]) + n.to_bytes(w, 'big')
def T(t, b):   return bytes([t]) + L(b) + b
def INT(n):    return T(0x02, n.to_bytes(max(1, (n.bit_length() + 8) // 8), 'big'))
def STR(s):    return T(0x04, s.encode('utf-8'))

# ─── décodage BER ────────────────────────────────────────────────────────────
def tlv(buf, i=0):
    """Retourne (tag, contenu, index_suivant)."""
    t = buf[i]; i += 1
    n = buf[i]; i += 1
    if n & 0x80:
        w = n & 0x7f
        n = int.from_bytes(buf[i:i+w], 'big'); i += w
    return t, buf[i:i+n], i + n

def walk(buf):
    i = 0
    while i < len(buf):
        t, c, i = tlv(buf, i)
        yield t, c

RESULT_CODES = {
    0:  'succès',
    1:  'erreur opérationnelle',
    32: 'objet inexistant — le base DN est faux',
    34: 'DN invalide — vérifier la syntaxe du -D',
    49: 'identifiants invalides — mot de passe faux, OU forme du compte non acceptée '
        '(l\'AD veut user@domaine, DOMAINE\\user ou un DN complet, pas un sAMAccountName nu)',
    53: 'refus du serveur — souvent : bind simple interdit hors TLS',
}

def recv_msg(s):
    """Lit exactement un message LDAP (SEQUENCE de tête)."""
    head = b''
    while len(head) < 2:
        head += s.recv(1)
    n = head[1]
    if n & 0x80:
        w = n & 0x7f
        while len(head) < 2 + w: head += s.recv(1)
        n = int.from_bytes(head[2:2+w], 'big')
        need = 2 + w + n
    else:
        need = 2 + n
    while len(head) < need:
        chunk = s.recv(need - len(head))
        if not chunk: break
        head += chunk
    return head

def main():
    pw = os.environ.get('MDP') or getpass.getpass(f'Mot de passe de {BIND_USER} : ')

    print(f"→ {DC}:636   bind {BIND_USER}   base {BASE_DN}\n")

    ctx = ssl.create_default_context()
    # Le DC présente en général un certificat d'AC interne : on ne le valide pas
    # POUR CE TEST. Authelia, lui, devra faire confiance à l'AC (voir README).
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with socket.create_connection((DC, 636), timeout=10) as raw:
        with ctx.wrap_socket(raw, server_hostname=DC) as s:
            s.settimeout(10)

            # ── BindRequest ────────────────────────────────────────────────
            s.sendall(T(0x30, INT(1) + T(0x60, INT(3) + STR(BIND_USER) + T(0x80, pw.encode()))))
            _, body, _ = tlv(recv_msg(s))
            code = None
            for t, c in walk(body):
                if t == 0x61:                       # BindResponse
                    code = tlv(c)[1][0]
                    msg = [x for x in walk(c)]
            if code != 0:
                print(f"✗ BIND REFUSÉ — code {code} : {RESULT_CODES.get(code, 'voir RFC 4511')}")
                return 1
            print("✓ bind accepté\n")

            # ── Une recherche par technicien ───────────────────────────────
            print(f"{'login':16} {'sAMAccountName':18} {'displayName':26} groupes")
            print('─' * 90)
            ok = 0
            par_tech = {}          # login -> set(groupes), pour l'intersection
            for mid, login in enumerate(LOGINS, start=2):
                flt = T(0xa3, STR('sAMAccountName') + STR(login))   # equalityMatch
                attrs = T(0x30, STR('sAMAccountName') + STR('displayName') + STR('memberOf'))
                req = T(0x63, STR(BASE_DN) + T(0x0a, b'\x02')       # scope subtree
                        + T(0x0a, b'\x00') + INT(0) + INT(30) + T(0x01, b'\x00') + flt + attrs)
                s.sendall(T(0x30, INT(mid) + req))

                found = {}
                while True:
                    _, body, _ = tlv(recv_msg(s))
                    done = False
                    for t, c in walk(body):
                        if t == 0x64:                               # SearchResultEntry
                            _, _, i = tlv(c)                        # objectName
                            _, plist, _ = tlv(c, i)
                            for _, attr in walk(plist):
                                _, name, j = tlv(attr)
                                _, vals, _ = tlv(attr, j)
                                found[name.decode()] = [v.decode('utf-8', 'replace')
                                                        for _, v in walk(vals)]
                        elif t == 0x65:                             # SearchResultDone
                            done = True
                    if done: break

                if not found:
                    print(f"{login:16} {'— introuvable —':18}")
                    continue
                ok += 1
                sam = found.get('sAMAccountName', [''])[0]
                dn  = found.get('displayName', [''])[0]
                grp = found.get('memberOf', [])
                cns = sorted(re.sub(r'^CN=([^,]+).*', r'\1', g) for g in grp)
                par_tech[login] = set(cns)
                match = '✓' if sam == login else '⚠ DIFFÈRE'
                print(f"{login:16} {sam:18} {dn[:26]:26} {len(grp)} groupe(s) {match}")

            print('─' * 90)
            print(f"{ok}/{len(LOGINS)} techniciens trouvés.\n")

            # ── Peut-on réutiliser un groupe existant ? ─────────────────────
            if par_tech:
                commun = set.intersection(*par_tech.values())
                print("GROUPES COMMUNS AUX", len(par_tech), "TECHNICIENS")
                print('─' * 90)
                if commun:
                    for c in sorted(commun):
                        print("  ✓", c, " ← réutilisable comme groupe technicien")
                else:
                    print("  aucun.")
                    # qui manque à quoi : le groupe le plus large et ses absents
                    tous = set().union(*par_tech.values())
                    scores = sorted(((sum(1 for g in par_tech.values() if c in g), c)
                                     for c in tous), reverse=True)
                    print("\n  Les plus proches :")
                    for n, c in scores[:5]:
                        absents = sorted(l for l, g in par_tech.items() if c not in g)
                        print(f"    {c:42} {n}/{len(par_tech)} — manquent : {', '.join(absents)}")
                    print("\n  ⚠ Rappel AD : le groupe PRIMAIRE (en général « Domain Users ») n'apparaît")
                    print("    JAMAIS dans memberOf. Un technicien à 0 groupe n'est pas hors du domaine,")
                    print("    il n'a simplement aucune appartenance secondaire.")
                    print("\n  → Conclusion : créer un groupe dédié et y mettre les 7.")
            # ── Les groupes d'accès existent-ils, et qui contiennent-ils ? ──
            if GROUPES:
                print("\n" + "GROUPES D'ACCÈS KARAVUNDOBOARD")
                print('─' * 90)
                for k, g in enumerate(GROUPES, start=100):
                    flt = T(0xa3, STR('cn') + STR(g))
                    attrs = T(0x30, STR('cn') + STR('member'))
                    req = T(0x63, STR(BASE_DN) + T(0x0a, b'\x02') + T(0x0a, b'\x00')
                            + INT(0) + INT(30) + T(0x01, b'\x00') + flt + attrs)
                    s.sendall(T(0x30, INT(k) + req))
                    found = {}
                    while True:
                        _, body, _ = tlv(recv_msg(s))
                        done = False
                        for t, c in walk(body):
                            if t == 0x64:
                                _, _, i = tlv(c)
                                _, plist, _ = tlv(c, i)
                                for _, attr in walk(plist):
                                    _, name, j = tlv(attr)
                                    _, vals, _ = tlv(attr, j)
                                    found[name.decode()] = [v.decode('utf-8', 'replace')
                                                            for _, v in walk(vals)]
                            elif t == 0x65:
                                done = True
                        if done: break
                    if not found:
                        print(f"  ✗ {g:32} n'existe pas sous ce nom")
                        continue
                    membres = [re.sub(r'^CN=([^,]+).*', r'\1', m) for m in found.get('member', [])]
                    print(f"  ✓ {g:32} {len(membres)} membre(s)")
                    for m in sorted(membres):
                        connu = ' ← technicien' if m in LOGINS or m in par_tech else ''
                        print(f"    {'':32} · {m}{connu}")
                    if not membres:
                        print(f"    {'':32} ⚠ VIDE — avec default_policy: deny, personne n'entrera")
                    manquants = [l for l in par_tech if l not in membres]
                    if membres and manquants and 'tech' in g:
                        print(f"    {'':32} ⚠ absents du groupe : {', '.join(manquants)}")

    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except socket.timeout:
        print(f"✗ délai dépassé — {DC}:636 ne répond pas depuis cette machine")
        sys.exit(1)
    except OSError as e:
        print(f"✗ connexion impossible à {DC}:636 — {e}")
        sys.exit(1)
