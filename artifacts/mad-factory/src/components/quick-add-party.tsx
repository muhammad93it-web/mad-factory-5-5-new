import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCustomer,
  useCreateSupplier,
  getListCustomersQueryKey,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import { Plus } from "lucide-react";

type Props = {
  kind: "customer" | "supplier";
  onCreated?: (id: number) => void;
  buttonLabel?: string;
  buttonClassName?: string;
  buttonSize?: "sm" | "default" | "lg";
  buttonVariant?: "default" | "outline";
};

export function QuickAddParty({ kind, onCreated, buttonLabel, buttonClassName, buttonSize = "sm", buttonVariant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const queryClient = useQueryClient();

  const reset = () => {
    setName("");
    setPhone("");
    setAddress("");
    setOpeningBalance(0);
  };

  const handleSuccess = (created: { id: number }) => {
    queryClient.invalidateQueries({
      queryKey: kind === "customer" ? getListCustomersQueryKey() : getListSuppliersQueryKey(),
    });
    queryClient.invalidateQueries({ queryKey: [kind === "customer" ? "customers" : "suppliers"] });
    onCreated?.(created.id);
    setOpen(false);
    reset();
  };

  const { mutate: createCustomer, isPending: cPending } = useCreateCustomer({
    mutation: { onSuccess: (data) => handleSuccess(data as { id: number }) },
  });
  const { mutate: createSupplier, isPending: sPending } = useCreateSupplier({
    mutation: { onSuccess: (data) => handleSuccess(data as { id: number }) },
  });

  const isPending = kind === "customer" ? cPending : sPending;
  const labels = kind === "customer"
    ? { title: "زیادکردنی کڕیاری نوێ", nameLabel: "ناوی کڕیار" }
    : { title: "زیادکردنی دابینکاری نوێ", nameLabel: "ناوی دابینکار" };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      openingBalance: openingBalance || 0,
    };
    if (kind === "customer") createCustomer({ data });
    else createSupplier({ data });
  };

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => setOpen(true)}
        className={buttonClassName ?? "gap-1 shrink-0"}
      >
        <Plus className={buttonSize === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        {buttonLabel ?? "نوێ"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>{labels.nameLabel} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ناو..." autoFocus />
            </div>
            <div>
              <Label>مۆبایل</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07..." dir="ltr" />
            </div>
            <div>
              <Label>ناونیشان</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ناونیشان..." />
            </div>
            <div>
              <Label>قەرزی سەرەتا (د.ع)</Label>
              <Input
                type="number"
                value={openingBalance || ""}
                onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                placeholder="0"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
              {isPending ? "تۆمارکردن..." : "پاشەکەوتکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
