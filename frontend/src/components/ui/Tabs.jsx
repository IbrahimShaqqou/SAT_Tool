/**
 * Tabs component for navigation between views
 */
import { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

const Tabs = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (newValue) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ children, className = '' }) => (
  <div
    className={`flex border-b border-edge ${className}`}
    role="tablist"
  >
    {children}
  </div>
);

const TabsTrigger = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);
  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => context.onChange(value)}
      className={`
        px-4 py-2 text-sm font-medium transition-colors
        border-b-2 -mb-px
        ${isActive
          ? 'border-brand-500 text-brand-700 dark:text-brand-400'
          : 'border-transparent text-ink-subtle hover:text-ink-muted hover:border-edge-strong'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);

  if (context.value !== value) return null;

  return (
    <div role="tabpanel" className={`pt-4 ${className}`}>
      {children}
    </div>
  );
};

Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export default Tabs;
