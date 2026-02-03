# Standalone 3D Globe Package

A self-contained 3D interactive globe component built with React Three Fiber and Three.js.

## Overview

This package contains a complete 3D globe visualization with:
- **Textured Earth** with NASA day/night textures and atmosphere shaders
- **Aurora Borealis** effects at both poles
- **Country markers** showing data points (with/without partners)
- **Flying airplanes** animation between cities
- **Network connections** arcs between major hubs
- **Selection highlight** with smooth camera zoom and rotation
- **Country toast** notifications with flag and name

## Installation

### Dependencies

Install these packages in your project:

```bash
npm install three @react-three/fiber @react-three/drei
# or
yarn add three @react-three/fiber @react-three/drei
# or
bun add three @react-three/fiber @react-three/drei
```

Required versions:
- `three`: ^0.160.0
- `@react-three/fiber`: ^8.18.0
- `@react-three/drei`: ^9.122.0

### Copy Files

1. Copy the entire `standalone-globe` folder to your project's `src` directory
2. Copy textures from `public/textures/` to your project's `public/textures/`:
   - `earth-day.jpg`
   - `earth-night.jpg`
   - `earth-bump.png`
   - `earth-specular.png`

## Usage

```tsx
import { StandaloneGlobe } from './standalone-globe';

function App() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <StandaloneGlobe
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        // Optional: provide custom data
        countries={customCountriesData}
        countryPartners={customPartnersData}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedCountry` | `string \| null` | Yes | ISO country code of selected country |
| `onCountrySelect` | `(code: string \| null) => void` | Yes | Callback when a country is clicked |
| `countries` | `CountryWithPartners[]` | No | Country data array (uses default WCA countries) |
| `countryPartners` | `GlobePartner[]` | No | Partners in selected country |

## Data Types

```typescript
interface CountryWithPartners {
  code: string;       // ISO 3166-1 alpha-2 code
  name: string;       // Country name
  count: number;      // Number of partners
  lat: number;        // Latitude
  lng: number;        // Longitude
  region: 'europe' | 'asia' | 'americas' | 'africa' | 'oceania' | 'middle_east';
}

interface GlobePartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
  lat: number;
  lng: number;
}
```

## Customization

### Using Custom Data

The globe comes with 249 pre-configured countries. To add partner counts:

```typescript
import { WCA_COUNTRIES } from './standalone-globe/data/wcaCountries';

// Create countries with your partner counts
const myCountries = WCA_COUNTRIES.map(country => ({
  ...country,
  count: yourDataMap[country.code] || 0,
}));

<StandaloneGlobe
  countries={myCountries}
  // ... other props
/>
```

### Styling

The globe uses a dark theme by default. The container should have a dark background for best results.

## File Structure

```
standalone-globe/
├── index.tsx                 # Main component export
├── StandaloneGlobe.tsx      # Globe wrapper component
├── components/
│   ├── TexturedEarth.tsx    # Earth with NASA textures
│   ├── AuroraBorealis.tsx   # Polar aurora effects
│   └── globe/
│       ├── InstancedCountryMarkers.tsx
│       ├── SelectionHighlight.tsx
│       ├── CityMarkers.tsx
│       ├── NetworkConnections.tsx
│       ├── FlyingAirplanes.tsx
│       └── CountryToast.tsx
├── data/
│   └── wcaCountries.ts      # 249 countries database
├── types.ts                  # TypeScript interfaces
└── utils.ts                  # Helper functions
```

## License

MIT
