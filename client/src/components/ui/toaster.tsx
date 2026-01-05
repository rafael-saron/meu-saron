import React, { createContext, useContext, useState, ReactNode } from "react";
import { Transition } from "@headlessui/react";

type Toast = {
  id: number;
  message: string;
  type?: "success" | "error" | "info";
};

type ToasterContextType = {
  addToast: (message: string, type?: "success" | "error" | "info") => void;
};

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

let toastId = 0;

export const useToaster = () => {
  const context = useContext(ToasterContext);
  if (!context) throw new Error("useToaster must be used within a ToasterProvider");
  return context;
};

export const ToasterProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToasterContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <Transition
            key={toast.id}
            appear
            show
            enter="transition ease-out duration-300 transform"
            enterFrom="opacity-0 translate-y-2"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-200 transform"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-2"
          >
            <div
              className={`
                px-4 py-2 rounded shadow-md text-sm
                ${toast.type === "success" ? "bg-green-500 text-white" : ""}
                ${toast.type === "error" ? "bg-red-500 text-white" : ""}
                ${toast.type === "info" ? "bg-gray-800 text-white" : ""}
              `}
            >
              {toast.message}
            </div>
          </Transition>
        ))}
      </div>
    </ToasterContext.Provider>
  );
};

// Componente Toaster que você importa no App.tsx
export const Toaster = () => {
  return null; // O visual do toast é gerenciado pelo ToasterProvider
};