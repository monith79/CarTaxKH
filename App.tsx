/**
 * App.tsx
 * Navigation: CarTypeSelect → CarImportTax → (TaxConfig accessible from both)
 */
import React, { useState } from 'react';
import CarTypeSelectScreen  from './screens/CarTypeSelectScreen';
import CarImportTaxScreen   from './screens/CarImportTaxScreen';
import TaxConfigScreen      from './screens/TaxConfigScreen';

type Screen = 'select' | 'calculator' | 'config';

export default function App() {
  const [screen,      setScreen]      = useState<Screen>('select');
  const [carTypeId,   setCarTypeId]   = useState<string>('petrol');
  const [prevScreen,  setPrevScreen]  = useState<Screen>('select');

  const goConfig = (from: Screen) => { setPrevScreen(from); setScreen('config'); };

  if (screen === 'config') {
    return <TaxConfigScreen onBack={() => setScreen(prevScreen)} />;
  }
  if (screen === 'calculator') {
    return (
      <CarImportTaxScreen
        carTypeId={carTypeId}
        onBack={() => setScreen('select')}
        onManageRates={() => goConfig('calculator')}
      />
    );
  }
  return (
    <CarTypeSelectScreen
      onNext={id => { setCarTypeId(id); setScreen('calculator'); }}
      onManageRates={() => goConfig('select')}
    />
  );
}
