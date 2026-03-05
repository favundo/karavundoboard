

## Plan : Bouton "Multi-devices" dans l'inventaire détaillé

### Objectif
Ajouter un bouton dans la barre d'outils de l'inventaire détaillé (page Siège et Groupes) qui ouvre une modale listant les collaborateurs possédant plusieurs équipements, avec leurs assets associés. Cette liste sera exportable en CSV et PDF.

### Composant à créer
**`src/components/dashboard/MultiDeviceModal.tsx`** — une modale (Dialog) qui :
1. Reçoit la liste complète `InventoryItem[]` en props
2. Calcule les UIDs apparaissant plus d'une fois (même logique que StatsCards)
3. Affiche un tableau groupé par collaborateur : **Nom**, **UID**, **Service**, puis pour chaque device : **Asset**, **Type**, **Windows**
4. Inclut boutons CSV et PDF en haut de la modale
5. Compteur du nombre de collaborateurs multi-devices

### Fonctions d'export à ajouter
**`src/lib/exportUtils.ts`** — deux nouvelles fonctions :
- `exportMultiDeviceToCSV(data)` : colonnes Nom, UID, Service, Asset, Type, Windows — une ligne par device, groupées par collaborateur
- `exportMultiDeviceToPDF(data)` : même structure, titre "Collaborateurs multi-devices"

### Modification existante
**`src/components/dashboard/InventoryTable.tsx`** :
- Ajouter un bouton "Multi-devices" (icône `Users`) dans la barre d'outils, à côté des boutons CSV/PDF
- Gérer l'état d'ouverture de la modale
- Passer `inventoryData` au composant `MultiDeviceModal`

### Même traitement pour Abcroisière
**`src/components/abcroisiere/AbcroisiereInventoryTable.tsx`** : même bouton et même modale réutilisée.

