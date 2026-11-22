import React from "react";
import MandiPriceIntelligence from "./MandiPriceIntelligence";

interface EnhancedMarketPricesProps {
  className?: string;
  onNavigate?: (module: string) => void;
}

export const EnhancedMarketPrices = ({ className, onNavigate }: EnhancedMarketPricesProps) => {
  return <MandiPriceIntelligence className={className} onNavigate={onNavigate} />;
};

export default EnhancedMarketPrices;
