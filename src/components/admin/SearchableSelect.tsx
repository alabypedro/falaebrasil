import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface SearchableOption {
  value: string;
  label: string;
  /** Cabeçalho do grupo (ex.: "Adultos", "Teens", "Kids"). */
  group?: string;
  /** Texto secundário à direita. */
  hint?: string;
  /** Palavras extras usadas na busca. */
  keywords?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** Ordem dos grupos; grupos ausentes vão para o fim, na ordem recebida. */
  groupOrder?: string[];
  disabled?: boolean;
}

const UNGROUPED = "__ungrouped__";

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado.",
  className,
  groupOrder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const groups = useMemo(() => {
    const map = new Map<string, SearchableOption[]>();
    for (const opt of options) {
      const key = opt.group ?? UNGROUPED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    const keys = [...map.keys()];
    keys.sort((a, b) => {
      if (a === UNGROUPED) return -1;
      if (b === UNGROUPED) return 1;
      const ia = groupOrder?.indexOf(a) ?? -1;
      const ib = groupOrder?.indexOf(b) ?? -1;
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    return keys.map((k) => ({ key: k, label: k === UNGROUPED ? null : k, items: map.get(k)! }));
  }, [options, groupOrder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command
          filter={(itemValue, search, keywords) => {
            const haystack = `${itemValue} ${(keywords ?? []).join(" ")}`.toLowerCase();
            const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
            return terms.every((t) => haystack.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />

          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.key} heading={g.label ?? undefined}>
                {g.items.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.keywords ?? ""}`}
                    keywords={[opt.label, opt.keywords ?? "", opt.hint ?? ""]}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        opt.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">{opt.hint}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default SearchableSelect;
