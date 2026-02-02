# Campaigns Backup - 2026-02-02

This backup contains the Campaigns page and all its components as of February 2, 2026.

## Files Included:

### Main Page
- `Campaigns.tsx` - Main campaigns page

### Campaign Components
- `components/CampaignGlobe.tsx` - 3D Globe component with country selection
- `components/TexturedEarth.tsx` - Night-only textured Earth with shaders
- `components/AuroraBorealis.tsx` - Aurora effects at poles
- `components/CompanyList.tsx` - Partner list with filters
- `components/EmailPreview.tsx` - Email composition dialog

### Globe Sub-components
- `components/globe/InstancedCountryMarkers.tsx` - Instanced markers for all countries
- `components/globe/SelectionHighlight.tsx` - Refined animated rings for selection
- `components/globe/CityMarkers.tsx` - City markers for selected country
- `components/globe/NetworkConnections.tsx` - Connection lines between countries
- `components/globe/FlyingAirplanes.tsx` - Dynamic airplanes flying between cities
- `components/globe/CountryToast.tsx` - Transparent toast with country name

## Features:
- Night-only globe view with NASA textures
- Animated aurora borealis/australis at poles
- Country selection with animated highlight rings
- Flying airplanes between partner cities
- Country name toast on selection
- Smooth zoom and rotation reset
- Partner selection and campaign management
- Email preview with templates
