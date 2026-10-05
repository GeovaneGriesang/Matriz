/**
 * Limites de uso do chat. O modelo roda em CPU na mesma VM do banco, então duas regras protegem o servidor: cada pessoa tem um teto de
 * perguntas por janela de tempo, e só uma resposta é gerada por vez (as demais pedem para tentar de novo em instantes).
 * Em memória: o app roda em um único processo, e reiniciar zera a contagem, o que é aceitável para este uso.
 */

export class LimitePorUsuario {
  private readonly usos = new Map<number, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
  ) {}

  /** Registra o uso e devolve true, ou devolve false (sem registrar) se a pessoa já gastou o teto da janela. */
  tentar(usuarioId: number, agora = Date.now()): boolean {
    const recentes = (this.usos.get(usuarioId) ?? []).filter((t) => agora - t < this.janelaMs);
    if (recentes.length >= this.maximo) {
      this.usos.set(usuarioId, recentes);
      return false;
    }
    recentes.push(agora);
    this.usos.set(usuarioId, recentes);
    return true;
  }

  /** Quantos segundos faltam para a pessoa poder perguntar de novo. */
  segundosParaLiberar(usuarioId: number, agora = Date.now()): number {
    const recentes = (this.usos.get(usuarioId) ?? []).filter((t) => agora - t < this.janelaMs);
    if (recentes.length < this.maximo || recentes.length === 0) return 0;
    return Math.ceil((recentes[0]! + this.janelaMs - agora) / 1000);
  }
}

/** Uma geração por vez. `tomar` devolve uma função para devolver a vez, ou null se já há outra em andamento (ou se a vez expirou sozinha). */
export class UmPorVez {
  private desde: number | null = null;

  constructor(private readonly expiraEmMs: number) {}

  tomar(agora = Date.now()): (() => void) | null {
    if (this.desde !== null && agora - this.desde < this.expiraEmMs) return null;
    const minha = agora;
    this.desde = minha;
    return () => {
      if (this.desde === minha) this.desde = null;
    };
  }
}
