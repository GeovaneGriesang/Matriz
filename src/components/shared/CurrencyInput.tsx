"use client";

import type { ChangeEvent } from "react";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface CurrencyInputProps {
  id?: string;
  /** Quando informado, renderiza um input hidden com o valor numérico bruto — para uso com FormData nativo. */
  name?: string;
  /** Valor em reais (não centavos). */
  value: number;
  onChange: (valorReais: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Campo de texto que aplica máscara de moeda (R$ 1.234,56) enquanto o usuário digita, guardando o valor bruto em reais. */
export function CurrencyInput({ id, name, value, onChange, disabled, className }: CurrencyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const somenteDigitos = event.target.value.replace(/\D/g, "");
    const centavos = somenteDigitos === "" ? 0 : parseInt(somenteDigitos, 10);
    onChange(centavos / 100);
  }

  const displayValue = value === 0 ? "" : formatoMoeda.format(value);

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="R$ 0,00"
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        className={className}
      />
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
