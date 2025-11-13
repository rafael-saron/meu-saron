import { Store } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDapicStores } from "@/hooks/use-dapic";

interface StoreSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const storeNames: Record<string, string> = {
  todas: "Todas as Lojas",
  saron1: "Saron 1",
  saron2: "Saron 2",
  saron3: "Saron 3",
};

export function StoreSelector({ value, onChange }: StoreSelectorProps) {
  const { data: availableStores = [], isLoading } = useDapicStores();

  const stores = [
    { id: "todas", name: "Todas as Lojas" },
    ...availableStores.map((id) => ({
      id,
      name: storeNames[id] || id,
    })),
  ];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <div className="w-[200px] h-9 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px]" data-testid="select-store">
          <SelectValue placeholder="Selecione a loja" />
        </SelectTrigger>
        <SelectContent>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id} data-testid={`option-store-${store.id}`}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
