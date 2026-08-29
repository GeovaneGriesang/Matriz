"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ANO_MINIMO_CAMPUS_NOVO } from "@/calculation-engine";
import { salvarAnoCriacaoUnidadeAction, criarUnidadeAction } from "@/server/actions/unidade";
import { apiUrl } from "@/lib/basePath";

interface UnidadeResumo {
  id: number;
  nome: string;
  anoCriacao: number | null;
  instituicaoId: number;
  instituicaoSigla: string;
}

type EstadoLinha = "idle" | "salvando" | "erro";

interface InstituicaoResumo {
  id: number;
  sigla: string;
  nome: string;
}

export function UnidadesAnoCriacaoPanel() {
  const [unidades, setUnidades] = useState<UnidadeResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<number, string>>({});
  const [estadoPorId, setEstadoPorId] = useState<Record<number, EstadoLinha>>({});
  const [instituicoes, setInstituicoes] = useState<InstituicaoResumo[]>([]);
  const [criando, setCriando] = useState(false);
  const [avisoCriacao, setAvisoCriacao] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregarUnidades = useCallback(() => {
    setCarregando(true);
    fetch(apiUrl("/api/unidades"))
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

  useEffect(() => carregarUnidades(), [carregarUnidades]);

  useEffect(() => {
    fetch(apiUrl("/api/instituicoes"))
      .then((r) => (r.ok ? (r.json() as Promise<InstituicaoResumo[]>) : []))
      .then(setInstituicoes)
      .catch(() => {
        // Sem a lista, o formulário de cadastro fica indisponível — a edição segue funcionando.
      });
  }, []);

  async function handleCriar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setCriando(true);
    setAvisoCriacao(null);
    try {
      const resultado = await criarUnidadeAction(formData);
      if (!resultado.ok) {
        setAvisoCriacao({ tipo: "erro", texto: resultado.errorMessage ?? "Não foi possível cadastrar." });
      } else {
        setAvisoCriacao({
          tipo: "ok",
          texto: `Câmpus "${formData.get("nome")}" cadastrado. Ele entra no cálculo apenas pelo Piso Mínimo enquanto não tiver dados da PNP.`,
        });
        form.reset();
        carregarUnidades();
      }
    } catch (error) {
      setAvisoCriacao({ tipo: "erro", texto: (error as Error).message });
    } finally {
      setCriando(false);
    }
  }

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
      <form
        onSubmit={handleCriar}
        className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <div>
          <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Cadastrar câmpus novo</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Os câmpus desta lista vêm dos arquivos da PNP. Um câmpus recém-criado{" "}
            <strong>ainda não tem matrícula</strong>, logo não aparece em nenhum arquivo da PNP e nunca surgiria
            aqui sozinho — mas a matriz da CONIF já o contempla, porque ele recebe o Piso Mínimo mesmo sem alunos.
            Cadastre-o aqui para que o piso chegue até ele.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="instituicaoId" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Instituição
            </label>
            <select
              id="instituicaoId"
              name="instituicaoId"
              required
              disabled={criando || instituicoes.length === 0}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">Selecione…</option>
              {instituicoes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sigla} — {i.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="nome" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Nome do câmpus
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              placeholder="Campus São Leopoldo"
              disabled={criando}
              className="w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="anoCriacaoNovo" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Ano de criação
            </label>
            <input
              id="anoCriacaoNovo"
              name="anoCriacao"
              type="number"
              min={1900}
              max={2100}
              placeholder="2026"
              disabled={criando}
              className="w-28 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <button
            type="submit"
            disabled={criando}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {criando ? "Cadastrando..." : "Cadastrar"}
          </button>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Escreva o nome <strong>exatamente como aparece na planilha da CONIF</strong>. A ingestão da PNP casa
          câmpus por instituição + nome, então um nome divergente criaria um câmpus duplicado, que nunca receberia
          dados. Só o Piso Mínimo usa o ano de criação, e apenas para câmpus de {ANO_MINIMO_CAMPUS_NOVO} em diante.
        </p>
        {avisoCriacao && (
          <p
            className={`rounded-md px-3 py-2 text-xs ${
              avisoCriacao.tipo === "ok"
                ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
                : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
            }`}
          >
            {avisoCriacao.texto}
          </p>
        )}
      </form>

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
