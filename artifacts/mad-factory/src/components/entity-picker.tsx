import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown, User } from "lucide-react";

export interface PickableEntity {
  id: number;
  name: string;
  phone?: string | null;
  phone2?: string | null;
}

export function EntityPicker<T extends PickableEntity>({
  entities,
  value,
  onChange,
  placeholder = "هەڵبژێرە...",
  searchPlaceholder = "گەڕان بە ناو، کۆد، یان مۆبایل...",
  emptyMessage = "هیچ ئەنجامێک نەدۆزرایەوە.",
  disabled = false,
}: {
  entities: T[] | undefined;
  value: number | null;
  onChange: (id: number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = entities?.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`truncate ${selected ? "font-semibold" : "text-slate-400"}`}>
            {selected ? `#${selected.id} — ${selected.name}` : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start" dir="rtl">
        <Command
          filter={(itemValue, search) => {
            // itemValue is `${id} ${name} ${phone ?? ""} ${phone2 ?? ""}` lowercased
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {entities?.map((e) => {
                const itemValue = `${e.id} ${e.name} ${e.phone ?? ""} ${e.phone2 ?? ""}`;
                return (
                  <CommandItem
                    key={e.id}
                    value={itemValue}
                    onSelect={() => {
                      onChange(e.id);
                      setOpen(false);
                    }}
                    className="group flex items-center gap-2 cursor-pointer text-slate-900 dark:text-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900 dark:data-[selected=true]:bg-slate-800 dark:data-[selected=true]:text-slate-50"
                  >
                    <Check className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${value === e.id ? "opacity-100" : "opacity-0"}`} />
                    <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-slate-900 dark:text-slate-50">
                        <span className="text-slate-500 dark:text-slate-400 ml-1" dir="ltr">#{e.id}</span> {e.name}
                      </div>
                      {(e.phone || e.phone2) && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate" dir="ltr">
                          {[e.phone, e.phone2].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
