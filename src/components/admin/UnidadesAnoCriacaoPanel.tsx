"use client";

import { useEffect, useMemo, useState } from "react";
import { ANO_MINIMO_CAMPUS_NOVO } from "@/calculation-engine";
import { salvarAnoCriacaoUnidadeAction } from "@/server/actions/unidade";

interface UnidadeResumo {
  id: number;
  nome: string;
  anoCriacao: number | null;
  instituicaoId: number;
  instituicaoSigla: string;
}

type EstadoLinha = "idle" | "salvando" | "erro";

export function UnidadesAnoCriacaoPanel() {
  const [unidades, setUnidades] = useState<UnidadeResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<number, string>>({});
  const [estadoPorId, setEstadoPorId] = useState<Record<number, EstadoLinha>>({});

  useEffect(() => {
    fetch("/api/unidades")
      .then((response) => (response.ok ? (response.json() as Promise<UnidadeResumo[]>) : []))
      .then((lista) => {
        setUnidades(lista);
        setValores(Object.fromEntries(lista.map((u) => [u.id, u.anoCriacao === null ? "" : String(u.anoCriacao)])));
      })
      .catch(() => {
        // Falha pontual ao listar não deve travar a tela.
      })
      .finally(() => setCarregando(false));
  }, []);

  const unidadesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return unidades;
    return unidades.filter(
      (u) => u.nome.toLowerCase().includes(termo) || u.instituicaoSigla.toLowerCase().includes(termo),
    );
  }, [unidades, busca]);

  async function salvar(unidadeId: number) {
    setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "salvando" }));
    try {
      const formData = new FormData();
      formData.set("unidadeId", String(unidadeId));
      formData.set("anoCriacao", valores[unidadeId] ?? "");
      const resultado = await salvarAnoCriacaoUnidadeAction(formData);
      if (!resultado.ok) throw new Error(resultado.errorMessage ?? "Não foi possível salvar.");

      const anoSalvo = valores[unidadeId] === "" ? null : Number(valores[unidadeId]);
      setUnidades((atual) => atual.map((u) => (u.id === unidadeId ? { ...u, anoCriacao: anoSalvo } : u)));
      setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "idle" }));
    } catch {
      setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "erro" }));
    }
  }

  if (carregando) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando câmpus...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Filtrar por câmpus ou sigla da instituição..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {unidadesFiltradas.length} de {unidades.length} câmpus. Câmpus com ano de criação a partir de{" "}
        {ANO_MINIMO_CAMPUS_NOVO} são elegíveis ao Piso Mínimo do Bloco Funcionamento.
      </p>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Câmpus</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Ano de criação</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
            </tr>
          </thead>
          <tbody>
            {unidadesFiltradas.map((u) => {
              const estado = estadoPorId[u.id] ?? "idle";
              const valorAtual = valores[u.id] ?? "";
              const elegivel = valorAtual !== "" && Number(valorAtual) >= ANO_MINIMO_CAMPUS_NOVO;
              return (
                <tr key={u.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{u.instituicaoSigla}</td>
                  <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">
                    {u.nome}
                    {elegivel && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Novo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="1"
                      placeholder="—"
                      value={valorAtual}
                      onChange={(e) =>
                        setValores((atual) => ({ ...atual, [u.id]: e.target.value }))
                      }
                      onBlur={() => {
                        if (valorAtual !== (u.anoCriacao === null ? "" : String(u.anoCriacao))) salvar(u.id);
                      }}
                      className="w-full min-w-28 rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {estado === "salvando" && <span className="text-neutral-500 dark:text-neutral-400">Salvando...</span>}
                    {estado === "erro" && <span className="text-red-600 dark:text-red-400">Erro ao salvar</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
