import { cn } from '@/lib/cn'

interface TabDef<T extends string> {
  id: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
  className?: string
}

export function Tabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn('border-b border-border', className)}>
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer',
              activeTab === tab.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
