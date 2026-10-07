"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRegistroDeTela } from "./ConfiguracoesSalvas";
import { Modal } from "./Modal";
import { salvos, type Destinatario, type ItemSalvo } from "@/lib/configuracoes/cliente";
import { nomeParaCopia } from "@/lib/configuracoes/regras";
import { alternar, desmarcarTodos, diferencaDeCompartilhamento, inverterSelecao, marcarTodos } from "@/lib/configuracoes/selecao";

/**
 * O painel de simulações e consultas salvas, no alto das telas. Nas telas de simulação (que se registram com `useConfiguracaoSalvavel`)
 * salva o estado da simulação; nas demais telas com filtros, salva o endereço (os filtros escolhidos) e, ao carregar, abre a tela com ele.
 */

/** Telas em que não há o que salvar quando não houver registro: não têm filtro nem simulação. */
const SEM_FILTROS = [/^\/$/, /^\/como-funciona/, /^\/situacao-dos-dados/, /^\/dados-importados/, /^\/admin/];

const BOTAO =
  "rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
const CAMPO = "rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";

type Janela = null | "salvarComo" | "renomear" | "compartilhar" | "excluir" | "conflito";

function rotuloDoItem(i: ItemSalvo): string {
  if (i.origem === "propria") return i.compartilhadaCom && i.compartilhadaCom.length > 0 ? `${i.nome} (compartilhada com ${i.compartilhadaCom.length})` : i.nome;
  if (i.origem === "compartilhada") return `${i.nome} (de ${i.dono.nome})`;
  return `${i.nome} (${i.dono.nome})`;
}

export function PainelSalvos() {
  const pathname = usePathname();
  const router = useRouter();
  const registro = useRegistroDeTela();
  const chave = registro?.chave ?? (SEM_FILTROS.some((r) => r.test(pathname)) ? null : pathname);

  const [itens, setItens] = useState<ItemSalvo[]>([]);
  const [escolhido, setEscolhido] = useState("");
  const [carregada, setCarregada] = useState<{ id: number; nome: string; versao: number; origem: ItemSalvo["origem"] } | null>(null);
  const [janela, setJanela] = useState<Janela>(null);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [erroDaJanela, setErroDaJanela] = useState("");

  const item = itens.find((i) => String(i.id) === escolhido) ?? null;
  const rotulo = registro?.rotulo ?? "estes filtros";

  const atualizarLista = useCallback(async () => {
    if (!chave) return;
    const r = await salvos.listar(chave);
    if (r.ok) setItens(r.dados);
    else if (r.status !== 403) setMensagem({ erro: true, texto: r.erro });
  }, [chave]);

  useEffect(() => {
    setItens([]);
    setEscolhido("");
    setCarregada(null);
    setMensagem(null);
    void atualizarLista();
  }, [chave, atualizarLista]);

  if (!chave) return null;

  const capturar = (): unknown => (registro ? registro.capturar() : { query: window.location.search });
  const aplicar = (dados: unknown) => {
    if (registro) registro.aplicar(dados);
    else router.push(pathname + ((dados as { query?: string } | null)?.query ?? ""));
  };
  const avisar = (texto: string, erro = false) => setMensagem({ erro, texto });

  async function carregar(id: number) {
    setOcupado(true);
    const r = await salvos.obter(id);
    setOcupado(false);
    if (!r.ok) return avisar(r.erro, true);
    aplicar(r.dados.dados);
    setCarregada({ id: r.dados.id, nome: r.dados.nome, versao: r.dados.versao, origem: r.dados.origem });
    setEscolhido(String(r.dados.id));
    avisar(`Carregada: ${r.dados.nome}.`);
  }

  async function salvar() {
    // Salvar por cima só vale para a que é sua e foi carregada; senão vira "Salvar como".
    if (!carregada || carregada.origem !== "propria") return abrirSalvarComo();
    setOcupado(true);
    const r = await salvos.atualizar(carregada.id, carregada.versao, { dados: capturar() });
    setOcupado(false);
    if (r.ok) {
      setCarregada({ id: r.dados.id, nome: r.dados.nome, versao: r.dados.versao, origem: r.dados.origem });
      void atualizarLista();
      return avisar(`Salva: ${r.dados.nome}.`);
    }
    if (r.status === 409 && r.conflito) {
      setErroDaJanela(r.erro);
      return setJanela("conflito");
    }
    avisar(r.erro, true);
  }

  function abrirSalvarComo() {
    setNomeDigitado(carregada ? nomeParaCopia(carregada.nome, itens.filter((i) => i.origem === "propria").map((i) => i.nome)) : "");
    setErroDaJanela("");
    setJanela("salvarComo");
  }

  async function confirmarSalvarComo() {
    setOcupado(true);
    const r = await salvos.criar(chave!, nomeDigitado, capturar());
    setOcupado(false);
    if (!r.ok) return setErroDaJanela(r.erro);
    setJanela(null);
    setCarregada({ id: r.dados.id, nome: r.dados.nome, versao: r.dados.versao, origem: r.dados.origem });
    setEscolhido(String(r.dados.id));
    void atualizarLista();
    avisar(`Salva: ${r.dados.nome}.`);
  }

  async function confirmarRenomear() {
    if (!item) return;
    setOcupado(true);
    const r = await salvos.atualizar(item.id, item.versao, { nome: nomeDigitado });
    setOcupado(false);
    if (!r.ok) return setErroDaJanela(r.erro);
    setJanela(null);
    if (carregada?.id === item.id) setCarregada({ ...carregada, nome: r.dados.nome, versao: r.dados.versao });
    void atualizarLista();
    avisar(`Renomeada para ${r.dados.nome}.`);
  }

  async function confirmarExcluir() {
    if (!item) return;
    setOcupado(true);
    const r = await salvos.excluir(item.id);
    setOcupado(false);
    if (!r.ok) return setErroDaJanela(r.erro);
    setJanela(null);
    if (carregada?.id === item.id) setCarregada(null);
    setEscolhido("");
    void atualizarLista();
    avisar(`Excluída: ${item.nome}.`);
  }

  const minha = item?.origem === "propria";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
      <label htmlFor="salvos" className="font-medium">
        {registro ? "Simulações salvas:" : "Consultas salvas:"}
      </label>
      <select id="salvos" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={`${CAMPO} max-w-[16rem] text-xs`} aria-label={`Escolher ${registro ? "uma simulação salva" : "uma consulta salva"}`}>
        <option value="">{itens.length === 0 ? "(nenhuma salva ainda)" : "(escolha uma para carregar)"}</option>
        {(["propria", "compartilhada", "de-outro-usuario"] as const).map((origem) => {
          const grupo = itens.filter((i) => i.origem === origem);
          if (grupo.length === 0) return null;
          const titulo = origem === "propria" ? "Minhas" : origem === "compartilhada" ? "Compartilhadas comigo" : "De outros usuários";
          return (
            <optgroup key={origem} label={titulo}>
              {grupo.map((i) => (
                <option key={i.id} value={i.id}>
                  {rotuloDoItem(i)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <button type="button" className={BOTAO} disabled={!item || ocupado} onClick={() => item && void carregar(item.id)} title={`Carrega ${rotulo} escolhida na lista`}>
        Carregar
      </button>
      <button
        type="button"
        className={BOTAO}
        disabled={ocupado}
        onClick={() => void salvar()}
        title={carregada?.origem === "propria" ? `Salva ${rotulo} por cima de "${carregada.nome}"` : `Salva ${rotulo} com um nome`}
      >
        Salvar
      </button>
      <button type="button" className={BOTAO} disabled={ocupado} onClick={abrirSalvarComo} title={`Salva ${rotulo} com outro nome, sem mexer nas já salvas`}>
        Salvar como…
      </button>
      {minha && (
        <>
          <button
            type="button"
            className={BOTAO}
            disabled={ocupado}
            onClick={() => {
              setNomeDigitado(item!.nome);
              setErroDaJanela("");
              setJanela("renomear");
            }}
          >
            Renomear
          </button>
          <button type="button" className={BOTAO} disabled={ocupado} onClick={() => setJanela("compartilhar")} title="Escolher com quem compartilhar: elas poderão carregar, mas não alterar a sua">
            Compartilhar…
          </button>
        </>
      )}
      {item && item.origem !== "compartilhada" && (
        <button
          type="button"
          className={BOTAO}
          disabled={ocupado}
          onClick={() => {
            setErroDaJanela("");
            setJanela("excluir");
          }}
        >
          Excluir
        </button>
      )}
      {carregada && (
        <span className="ml-1">
          Em uso: <strong className="text-neutral-800 dark:text-neutral-200">{carregada.nome}</strong>
          {carregada.origem !== "propria" ? " (de outra pessoa: use Salvar como para ter a sua cópia)" : ""}
        </span>
      )}
      <span role="status" aria-live="polite" className={mensagem?.erro ? "text-if-red dark:text-red-400" : "text-if-green"}>
        {mensagem?.texto}
      </span>

      {(janela === "salvarComo" || janela === "renomear") && (
        <Modal titulo={janela === "salvarComo" ? `Salvar ${rotulo}` : "Renomear"} aoFechar={() => setJanela(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void (janela === "salvarComo" ? confirmarSalvarComo() : confirmarRenomear());
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
              Nome
              <input autoFocus value={nomeDigitado} maxLength={120} onChange={(e) => setNomeDigitado(e.target.value)} className={CAMPO} placeholder="ex.: Cenário com o curso de Enfermagem" />
            </label>
            <p className="text-xs text-neutral-500">
              {janela === "salvarComo"
                ? "Fica salva só para você. Depois você pode compartilhá-la com quem quiser. O mesmo nome não pode ser usado duas vezes nesta tela."
                : "Só muda o nome; o conteúdo da simulação continua o mesmo."}
            </p>
            {erroDaJanela && <p className="text-sm text-if-red dark:text-red-400">{erroDaJanela}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BOTAO} onClick={() => setJanela(null)}>
                Cancelar
              </button>
              <button type="submit" disabled={ocupado || nomeDigitado.trim() === ""} className="rounded bg-if-green px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
                {janela === "salvarComo" ? "Salvar" : "Renomear"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {janela === "excluir" && item && (
        <Modal titulo="Excluir" aoFechar={() => setJanela(null)}>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Excluir <strong>{item.nome}</strong>
            {item.origem === "de-outro-usuario" ? ` (de ${item.dono.nome})` : ""}? As pessoas com quem ela foi compartilhada também deixam de vê-la. Não dá para desfazer.
          </p>
          {erroDaJanela && <p className="text-sm text-if-red dark:text-red-400">{erroDaJanela}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO} onClick={() => setJanela(null)}>
              Cancelar
            </button>
            <button type="button" disabled={ocupado} onClick={() => void confirmarExcluir()} className="rounded bg-if-red px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
              Excluir
            </button>
          </div>
        </Modal>
      )}

      {janela === "conflito" && carregada && (
        <Modal titulo="Alguém salvou antes de você" aoFechar={() => setJanela(null)}>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{erroDaJanela}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BOTAO} onClick={() => setJanela(null)}>
              Fechar
            </button>
            <button
              type="button"
              className={BOTAO}
              onClick={() => {
                setJanela(null);
                void carregar(carregada.id);
              }}
            >
              Carregar a versão salva (perde o que não foi salvo)
            </button>
            <button type="button" className="rounded bg-if-green px-3 py-1 text-sm font-medium text-white" onClick={abrirSalvarComo}>
              Salvar a minha como cópia
            </button>
          </div>
        </Modal>
      )}

      {janela === "compartilhar" && item && (
        <JanelaDeCompartilhamento
          item={item}
          aoFechar={() => setJanela(null)}
          aoSalvar={(n) => {
            setJanela(null);
            void atualizarLista();
            avisar(n === 0 ? "Deixou de ser compartilhada." : `Compartilhada com ${n} pessoa(s).`);
          }}
        />
      )}
    </div>
  );
}

function JanelaDeCompartilhamento({ item, aoFechar, aoSalvar }: { item: ItemSalvo; aoFechar: () => void; aoSalvar: (quantas: number) => void }) {
  const [pessoas, setPessoas] = useState<Destinatario[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const jaCompartilhados = useMemo(() => (item.compartilhadaCom ?? []).map((p) => p.id), [item]);
  const [marcados, setMarcados] = useState<Set<number>>(new Set(jaCompartilhados));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void salvos.destinatarios().then((r) => (r.ok ? setPessoas(r.dados) : setErro(r.erro)));
  }, []);

  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (pessoas ?? []).filter((p) => !b || p.nome.toLowerCase().includes(b) || p.email.toLowerCase().includes(b));
  }, [pessoas, busca]);
  const idsVisiveis = visiveis.map((p) => p.id);
  const { adicionados, removidos } = diferencaDeCompartilhamento(jaCompartilhados, marcados);

  async function confirmar() {
    setSalvando(true);
    const r = await salvos.compartilhar(item.id, [...marcados]);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(r.dados.length);
  }

  return (
    <Modal titulo={`Compartilhar: ${item.nome}`} aoFechar={aoFechar} largura="max-w-xl">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Quem for marcado vê esta simulação na lista dela e pode carregá-la. Não pode alterar a sua: se quiser mexer, salva uma cópia com o nome dela.
      </p>
      {pessoas === null && !erro && <p className="text-sm text-neutral-500">Carregando as pessoas...</p>}
      {pessoas !== null && (
        <>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className={`${CAMPO} w-full`} aria-label="Buscar pessoa" autoFocus />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={BOTAO} onClick={() => setMarcados((s) => marcarTodos(s, idsVisiveis))}>
              Marcar todos{busca ? " (da busca)" : ""}
            </button>
            <button type="button" className={BOTAO} onClick={() => setMarcados((s) => desmarcarTodos(s, idsVisiveis))}>
              Desmarcar todos{busca ? " (da busca)" : ""}
            </button>
            <button type="button" className={BOTAO} onClick={() => setMarcados((s) => inverterSelecao(s, idsVisiveis))}>
              Inverter seleção
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800" aria-label="Pessoas">
            {visiveis.length === 0 && <li className="px-3 py-2 text-sm text-neutral-500">Ninguém encontrado.</li>}
            {visiveis.map((p) => (
              <li key={p.id} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => setMarcados((s) => alternar(s, p.id))} />
                  <span className="flex flex-col">
                    <span className="text-neutral-900 dark:text-neutral-100">{p.nome}</span>
                    <span className="text-xs text-neutral-500">{p.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-600 dark:text-neutral-400" aria-live="polite">
            {marcados.size} de {pessoas.length} marcada(s)
            {adicionados.length + removidos.length > 0 ? `: ${adicionados.length} nova(s), ${removidos.length} retirada(s)` : ""}.
          </p>
        </>
      )}
      {erro && <p className="text-sm text-if-red dark:text-red-400">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={BOTAO} onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" disabled={salvando || pessoas === null || (adicionados.length === 0 && removidos.length === 0)} onClick={() => void confirmar()} className="rounded bg-if-green px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
          Salvar compartilhamento
        </button>
      </div>
    </Modal>
  );
}
