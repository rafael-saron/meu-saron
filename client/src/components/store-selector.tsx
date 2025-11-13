import { Store, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const stores = [
  { id: "all", name: "Todas as Lojas" },
  { id: "1", name: "Loja Centro" },
  { id: "2", name: "Loja Shopping" },
  { id: "3", name: "Loja Norte" },
];

interface StoreSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function StoreSelector({ value, onChange }: StoreSelectorProps) {
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
