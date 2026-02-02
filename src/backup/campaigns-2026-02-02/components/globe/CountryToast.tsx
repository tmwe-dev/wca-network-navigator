import { useEffect, useState, useRef } from "react";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";

interface Props {
  countryCode: string | null;
}

export function CountryToast({ countryCode }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayedCountry, setDisplayedCountry] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (countryCode) {
      setDisplayedCountry(countryCode);
      setVisible(true);
      
      // Auto-hide after 3 seconds
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 3000);
    } else {
      setVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [countryCode]);

  const country = displayedCountry ? WCA_COUNTRIES_MAP[displayedCountry] : null;

  if (!country) return null;

  return (
    <div
      className={`
        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        pointer-events-none z-20
        transition-all duration-500 ease-out
        ${visible 
          ? 'opacity-100 scale-100' 
          : 'opacity-0 scale-95'
        }
      `}
    >
      <div className="flex items-center gap-3 text-center">
        <span className="text-4xl drop-shadow-lg">
          {getCountryFlag(displayedCountry!)}
        </span>
        <div className="flex flex-col items-start">
          <span 
            className="text-3xl text-white tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
            style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.5), 0 2px 10px rgba(0,0,0,0.8)' }}
          >
            {country.name}
          </span>
          <span className="text-sm text-amber-300/80 tracking-widest uppercase">
            {country.region}
          </span>
        </div>
      </div>
    </div>
  );
}
