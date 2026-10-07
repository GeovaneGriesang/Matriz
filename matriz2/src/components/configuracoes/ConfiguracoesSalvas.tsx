"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * Como uma tela diz ao sistema o que dá para salvar nela. Telas cujo estado vive só no navegador (os simuladores) chamam
 * `useConfiguracaoSalvavel` e entregam duas funções: uma que devolve o estado atual e outra que aplica um estado salvo. As telas que
 * guardam o que a pessoa escolheu no próprio endereço (as consultas, com seus filtros) não precisam fazer nada: o painel salva e carrega
 * o endereço.
 */

export interface RegistroDeTela {
  /** Identifica a tela e o contexto dela (ex.: "simulador/projecao:IFSUL:2027"). Configurações salvas de chaves diferentes não se misturam. */
  chave: string;
  /** Como a tela chama o que se salva: "esta simulação", "estes filtros". */
  rotulo: string;
  capturar: () => unknown;
  aplicar: (dados: unknown) => void;
}

interface Contexto {
  registro: RegistroDeTela | null;
  registrar: (r: RegistroDeTela | null) => void;
}

const ContextoSalvos = createContext<Contexto>({ registro: null, registrar: () => undefined });

export function ConfiguracoesProvider({ children }: { children: React.ReactNode }) {
  const [registro, setRegistro] = useState<RegistroDeTela | null>(null);
  return <ContextoSalvos.Provider value={{ registro, registrar: setRegistro }}>{children}</ContextoSalvos.Provider>;
}

/** Guardas para aplicar um estado salvo campo a campo: um campo ausente ou do tipo errado (cenário antigo) é ignorado e o resto se aplica. */
export const comoNumero = (definir: (v: number) => void) => (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) definir(v);
};
export const comoBooleano = (definir: (v: boolean) => void) => (v: unknown) => {
  if (typeof v === "boolean") definir(v);
};
export const comoTexto = (definir: (v: string) => void) => (v: unknown) => {
  if (typeof v === "string") definir(v);
};
export const comoObjeto = <T,>(definir: (v: T) => void) => (v: unknown) => {
  if (v !== null && typeof v === "object") definir(v as T);
};
export function aplicarCampos(dados: unknown, regras: Record<string, (v: unknown) => void>) {
  if (dados === null || typeof dados !== "object") return;
  const d = dados as Record<string, unknown>;
  for (const [campo, aplicar] of Object.entries(regras)) if (campo in d) aplicar(d[campo]);
}

export function useRegistroDeTela(): RegistroDeTela | null {
  return useContext(ContextoSalvos).registro;
}

/** A tela se torna "salvável": o painel de simulações salvas aparece no alto, ligado a esta tela. */
export function useConfiguracaoSalvavel(r: { chave: string; rotulo: string; capturar: () => unknown; aplicar: (dados: unknown) => void }) {
  const { registrar } = useContext(ContextoSalvos);
  // As funções mudam a cada renderização (enxergam o estado novo), mas o registro só precisa ser refeito quando a chave muda.
  const funcoes = useRef({ capturar: r.capturar, aplicar: r.aplicar });
  funcoes.current = { capturar: r.capturar, aplicar: r.aplicar };
  useEffect(() => {
    registrar({ chave: r.chave, rotulo: r.rotulo, capturar: () => funcoes.current.capturar(), aplicar: (d) => funcoes.current.aplicar(d) });
    return () => registrar(null);
  }, [registrar, r.chave, r.rotulo]);
}
