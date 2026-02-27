
1) Allineare il layout globale alla route reale di Operations
- File: `src/components/layout/AppLayout.tsx`
- Introdurre `isOperationsRoute = currentPath === "/" || currentPath === "/operations"`.
- Applicare stessa configurazione a entrambe le route: `main` senza `p-6`, con `flex-1 min-h-0 overflow-hidden`.
- Rendere la colonna contenuto `min-h-0` (catena flex completa) per evitare clipping dello scroll interno.

2) Stabilizzare la gerarchia altezza/overflow di Operations (single-scroll architecture)
- File: `src/pages/Operations.tsx`
- Portare il root a `h-full min-h-0 flex flex-col overflow-hidden`.
- Mantenere header/stats `flex-shrink-0`.
- Rendere l’area centrale `flex-1 min-h-0 overflow-hidden` e delegare lo scroll solo ai pannelli interni.
- Rimuovere eventuali overflow concorrenti non necessari nei wrapper intermedi.

3) Rifattorizzare gli scroller interni (Country + Partner list) con overflow nativo coerente
- File: `src/components/download/CountryGrid.tsx`
- Garantire `min-h-0` su tutti i parent flex e un unico `overflow-y-auto` nel contenitore lista paesi.
- Evitare wrapper aggiuntivi che intercettano lo scroll.
- File: `src/components/operations/PartnerListPanel.tsx`
- Root panel: `h-full min-h-0 flex flex-col`.
- Header/wizard: `flex-shrink-0`.
- Lista partner: unico `flex-1 min-h-0 overflow-y-auto`.
- Separare i blocchi terminal/job in un contenitore con altezza controllata senza soffocare la lista.

4) Eliminare i warning React sui ref nel render di PartnerListPanel
- File: `src/components/operations/PartnerListPanel.tsx` (e componenti collegati nel render path)
- Cercare e rimuovere passaggi `ref` impliciti verso function components (WizardRow / DownloadTerminal) tramite trigger/slot.
- Dove serve `asChild`, usare solo elementi DOM (`button/div`) o componenti `forwardRef`.
- Obiettivo: console pulita da warning `Function components cannot be given refs`.

5) Verifica end-to-end obbligatoria
- Testare route `"/"` e `"/operations"` con stesso comportamento.
- Verificare scroll completo:
  - colonna paesi (fino in fondo),
  - lista partner (fino in fondo),
  - overlay dettaglio partner.
- Verificare stato con wizard aperto/chiuso e con terminal/job visibili.
- Verificare assenza warning ref in console durante interazione completa.
