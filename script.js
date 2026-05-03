document.getElementById("ano").textContent = new Date().getFullYear();
document.documentElement.classList.add("js");

const depoimentosLista = document.getElementById("depoimentos-lista");
const depoimentosWrapper = depoimentosLista ? depoimentosLista.parentElement : null;
const botaoDepAnterior = document.getElementById("dep-prev");
const botaoDepProximo = document.getElementById("dep-next");

/*
    ARQUITETURA DO CARROSSEL (resumo de estudo):
    1) Painel principal (#depoimentos-lista) mostra o bloco atual.
    2) Painel auxiliar (.depoimentos-grid-aux) e criado durante a troca.
    3) Os dois paineis deslizam juntos (um sai e outro entra).
    4) Nao usamos fade/opacity na troca, para evitar "sumico" de comentarios.
*/

/*
    Parametros principais do carrossel.
    Futuras alteracoes:
    - Quantidade visivel: DEPOIMENTOS_POR_VEZ
    - Intervalo automatico: ROTACAO_AUTOMATICA_MS
    - Sensibilidade de troca por arrasto: LIMIAR_DRAG_PX e VELOCIDADE_FLICK
*/
const DEPOIMENTOS_POR_VEZ = 3;
const ROTACAO_AUTOMATICA_MS = 9000;
const DURACAO_TRANSICAO_MS = 760;
const DURACAO_MIN_MS = 260;
const DURACAO_MAX_MS = 900;
const LIMIAR_DRAG_PX = 64;
const VELOCIDADE_FLICK = 0.55;
const EASING_SUAVE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/*
    GUIA RAPIDO DE AJUSTE:
    - Mais lento: aumente DURACAO_TRANSICAO_MS.
    - Mais rapido: diminua DURACAO_TRANSICAO_MS.
    - Drag mais sensivel: diminua LIMIAR_DRAG_PX.
    - Exigir arrasto mais firme: aumente LIMIAR_DRAG_PX.
    - Aceitar flick curto: diminua VELOCIDADE_FLICK.
*/

let todosDepoimentos = [];
let indiceAtualDepoimentos = 0;
let temporizadorRotacao = null;
let transicaoAtiva = false;

/* Estado do arrasto para mouse e touch via Pointer Events */
const drag = {
    ativo: false,
    pointerId: null,
    startX: 0,
    ultimoX: 0,
    ultimoTempo: 0,
    velocidade: 0,
    direcao: null,
    indicePreview: 0,
    painelAux: null
};

const fallbackDepoimentos = [
    {
        texto: "Em 6 semanas perdi 5kg e ganhei energia para trabalhar e cuidar da familia sem cansaco extremo.",
        autor: "Marina, 32 anos"
    },
    {
        texto: "Antes eu desistia na segunda semana. Com o acompanhamento, virei constante e ja reduzi 8cm de cintura.",
        autor: "Rafael, 41 anos"
    },
    {
        texto: "Os treinos cabem na minha rotina. Voltei a gostar de me olhar no espelho e minha autoestima mudou.",
        autor: "Camila, 27 anos"
    },
    {
        texto: "Com treino curto e objetivo, consegui ganhar forca e melhorar minha postura em menos de dois meses.",
        autor: "Leandro, 36 anos"
    },
    {
        texto: "Eu nao tinha disciplina. Hoje treino 4x por semana e estou mais confiante com meu corpo.",
        autor: "Aline, 29 anos"
    },
    {
        texto: "Parei de sentir dores nas costas e voltei a ter disposicao para jogar bola com meu filho.",
        autor: "Rodrigo, 44 anos"
    }
];

function montarHTMLDepoimentos(lista) {
    return lista.map((item) => `
        <article class="depoimento">
            <p>"${item.texto}"</p>
            <h3>${item.autor}</h3>
        </article>
    `).join("");
}

function renderizarDepoimentos(lista) {
    if (!depoimentosLista || !Array.isArray(lista) || lista.length === 0) {
        return;
    }

    depoimentosLista.innerHTML = montarHTMLDepoimentos(lista);
}

function obterBlocoCircular(lista, inicio, quantidade) {
    const bloco = [];

    for (let i = 0; i < quantidade; i += 1) {
        const indice = (inicio + i) % lista.length;
        bloco.push(lista[indice]);
    }

    return bloco;
}

function indiceDestino(direcao) {
    if (direcao === "proximo") {
        return (indiceAtualDepoimentos + DEPOIMENTOS_POR_VEZ) % todosDepoimentos.length;
    }
    return (indiceAtualDepoimentos - DEPOIMENTOS_POR_VEZ + todosDepoimentos.length) % todosDepoimentos.length;
}

function renderizarPaginaAtualDepoimentos() {
    if (todosDepoimentos.length === 0) {
        return;
    }

    const bloco = obterBlocoCircular(todosDepoimentos, indiceAtualDepoimentos, DEPOIMENTOS_POR_VEZ);
    renderizarDepoimentos(bloco);
}

function limparTransicaoPainelPrincipal() {
    if (!depoimentosLista) {
        return;
    }

    depoimentosLista.style.transform = "";
    depoimentosLista.style.transition = "";
    depoimentosLista.classList.remove("is-animating", "is-dragging");
}

function limparPainelAuxiliar() {
    if (drag.painelAux && drag.painelAux.parentElement) {
        drag.painelAux.parentElement.removeChild(drag.painelAux);
    }
    drag.painelAux = null;
    drag.direcao = null;
}

function criarPainelAuxiliar(direcao) {
    if (!depoimentosWrapper || !depoimentosLista || todosDepoimentos.length === 0) {
        return null;
    }

    const indice = indiceDestino(direcao);
    const bloco = obterBlocoCircular(todosDepoimentos, indice, DEPOIMENTOS_POR_VEZ);

    const painel = depoimentosLista.cloneNode(false);
    painel.removeAttribute("id");
    painel.classList.add("depoimentos-grid-aux");
    painel.innerHTML = montarHTMLDepoimentos(bloco);

    drag.indicePreview = indice;
    depoimentosWrapper.appendChild(painel);
    drag.painelAux = painel;
    drag.direcao = direcao;
    return painel;
}

function obterLarguraPainel() {
    if (!depoimentosWrapper) {
        return 0;
    }
    return depoimentosWrapper.clientWidth;
}

function pausarRotacaoAutomatica() {
    if (temporizadorRotacao) {
        window.clearInterval(temporizadorRotacao);
        temporizadorRotacao = null;
    }
}

function reiniciarRotacaoAutomatica() {
    pausarRotacaoAutomatica();
    iniciarRotacaoAutomatica();
}

function animarTrocaDireta(direcao, duracao = DURACAO_TRANSICAO_MS) {
    if (!depoimentosLista || !depoimentosWrapper || todosDepoimentos.length === 0 || transicaoAtiva) {
        return;
    }

    const largura = obterLarguraPainel();
    if (!largura) {
        return;
    }

    transicaoAtiva = true;
    const painelAux = criarPainelAuxiliar(direcao);
    if (!painelAux) {
        transicaoAtiva = false;
        return;
    }

    // Direcao de entrada/saida em pixels: usa largura total para slide completo.
    const inicioAux = direcao === "proximo" ? largura : -largura;
    const saidaPrincipal = direcao === "proximo" ? -largura : largura;
    const easing = `transform ${duracao}ms ${EASING_SUAVE}`;

    depoimentosWrapper.style.height = depoimentosWrapper.offsetHeight + "px";
    depoimentosLista.classList.add("is-animating");

    painelAux.style.transform = `translateX(${inicioAux}px)`;
    painelAux.style.transition = "none";
    depoimentosLista.style.transform = "translateX(0)";
    depoimentosLista.style.transition = "none";

    // Um frame depois, dispara a transicao para garantir interpolacao suave.
    requestAnimationFrame(() => {
        painelAux.style.transition = easing;
        depoimentosLista.style.transition = easing;
        painelAux.style.transform = "translateX(0)";
        depoimentosLista.style.transform = `translateX(${saidaPrincipal}px)`;
    });

    window.setTimeout(() => {
        indiceAtualDepoimentos = drag.indicePreview;
        renderizarPaginaAtualDepoimentos();
        limparPainelAuxiliar();
        limparTransicaoPainelPrincipal();
        depoimentosWrapper.style.height = "";
        transicaoAtiva = false;
    }, duracao + 40);
}

function proximoBlocoDepoimentos() {
    animarTrocaDireta("proximo");
}

function blocoAnteriorDepoimentos() {
    animarTrocaDireta("anterior");
}

function iniciarRotacaoAutomatica() {
    if (todosDepoimentos.length <= DEPOIMENTOS_POR_VEZ) {
        return;
    }

    if (temporizadorRotacao) {
        return;
    }

    /*
        Rotacao infinita sem fim: a cada ciclo avanca 1 bloco.
        Como o indice e circular, a navegacao nunca para.
    */
    temporizadorRotacao = window.setInterval(() => {
        animarTrocaDireta("proximo");
    }, ROTACAO_AUTOMATICA_MS);
}

function prepararPainelAuxDuranteArrasto(direcao) {
    const largura = obterLarguraPainel();
    if (!largura) {
        return;
    }

    if (!drag.painelAux || drag.direcao !== direcao) {
        limparPainelAuxiliar();
        const painel = criarPainelAuxiliar(direcao);
        if (!painel) {
            return;
        }

        painel.style.transition = "none";
        painel.style.transform = `translateX(${direcao === "proximo" ? largura : -largura}px)`;
    }
}

function iniciarArrasto(clientX, pointerId) {
    if (!depoimentosLista || transicaoAtiva || todosDepoimentos.length <= DEPOIMENTOS_POR_VEZ) {
        return;
    }

    drag.ativo = true;
    drag.pointerId = pointerId;
    drag.startX = clientX;
    drag.ultimoX = clientX;
    drag.ultimoTempo = performance.now();
    drag.velocidade = 0;
    drag.direcao = null;

    depoimentosLista.classList.add("is-dragging");
    pausarRotacaoAutomatica();
}

function atualizarArrasto(clientX) {
    if (!drag.ativo || transicaoAtiva || !depoimentosLista) {
        return;
    }

    const agora = performance.now();
    const delta = clientX - drag.startX;
    const absDelta = Math.abs(delta);

    if (absDelta < 2) {
        return;
    }

    const direcao = delta < 0 ? "proximo" : "anterior";
    prepararPainelAuxDuranteArrasto(direcao);
    if (!drag.painelAux) {
        return;
    }

    const largura = obterLarguraPainel();
    const inicioAux = direcao === "proximo" ? largura : -largura;

    // Acompanha o mouse quase 1:1 para parecer interativo e natural.
    depoimentosLista.style.transform = `translateX(${delta}px)`;
    drag.painelAux.style.transform = `translateX(${inicioAux + delta}px)`;

    const dt = Math.max(agora - drag.ultimoTempo, 1);
    drag.velocidade = (clientX - drag.ultimoX) / dt;
    drag.ultimoX = clientX;
    drag.ultimoTempo = agora;
}

function finalizarArrasto(clientX) {
    if (!drag.ativo || !depoimentosLista || !depoimentosWrapper) {
        return;
    }

    drag.ativo = false;
    depoimentosLista.classList.remove("is-dragging");

    const delta = clientX - drag.startX;
    const direcao = delta < 0 ? "proximo" : "anterior";
    const absDelta = Math.abs(delta);
    const absVelocidade = Math.abs(drag.velocidade);
    const largura = obterLarguraPainel();

    if (!drag.painelAux || !largura) {
        limparPainelAuxiliar();
        limparTransicaoPainelPrincipal();
        reiniciarRotacaoAutomatica();
        return;
    }

    // Troca se o usuario arrastou distancia suficiente OU fez um flick rapido.
    const trocaPorDistancia = absDelta >= LIMIAR_DRAG_PX;
    const trocaPorFlick = absVelocidade >= VELOCIDADE_FLICK;
    const deveTrocar = trocaPorDistancia || trocaPorFlick;

    const baseRestante = Math.max(largura - absDelta, 0) / largura;
    const fatorVelocidade = Math.max(0.4, 1 - absVelocidade * 0.45);
    // Duracao adaptativa: arrasto curto/rapido finaliza mais rapido, longo mais suave.
    const duracao = Math.min(
        DURACAO_MAX_MS,
        Math.max(DURACAO_MIN_MS, Math.round((DURACAO_TRANSICAO_MS * baseRestante + 140) * fatorVelocidade))
    );

    const easing = `transform ${duracao}ms ${EASING_SUAVE}`;
    const alvoPrincipal = deveTrocar ? (direcao === "proximo" ? -largura : largura) : 0;
    const alvoAux = deveTrocar ? 0 : (direcao === "proximo" ? largura : -largura);

    transicaoAtiva = true;
    depoimentosLista.classList.add("is-animating");
    drag.painelAux.style.transition = easing;
    depoimentosLista.style.transition = easing;

    requestAnimationFrame(() => {
        depoimentosLista.style.transform = `translateX(${alvoPrincipal}px)`;
        drag.painelAux.style.transform = `translateX(${alvoAux}px)`;
    });

    window.setTimeout(() => {
        if (deveTrocar) {
            indiceAtualDepoimentos = drag.indicePreview;
            renderizarPaginaAtualDepoimentos();
        }

        limparPainelAuxiliar();
        limparTransicaoPainelPrincipal();
        transicaoAtiva = false;
        reiniciarRotacaoAutomatica();
    }, duracao + 30);
}

function cancelarArrasto() {
    if (!drag.ativo) {
        return;
    }

    drag.ativo = false;
    limparPainelAuxiliar();
    limparTransicaoPainelPrincipal();
    reiniciarRotacaoAutomatica();
}

function prepararDragDepoimentos() {
    if (!depoimentosLista) {
        return;
    }

    /*
        Arrasto com pointer events (mouse/touch/caneta) com resposta de velocidade.
        Durante o drag, o painel segue o movimento do ponteiro.
        No fim, decide trocar ou voltar com base em distancia e velocidade.
    */
    depoimentosLista.addEventListener("pointerdown", (event) => {
        iniciarArrasto(event.clientX, event.pointerId);
    });

    window.addEventListener("pointermove", (event) => {
        if (!drag.ativo || event.pointerId !== drag.pointerId) {
            return;
        }
        atualizarArrasto(event.clientX);
    });

    window.addEventListener("pointerup", (event) => {
        if (!drag.ativo || event.pointerId !== drag.pointerId) {
            return;
        }
        finalizarArrasto(event.clientX);
        drag.pointerId = null;
    });

    window.addEventListener("pointercancel", () => {
        cancelarArrasto();
        drag.pointerId = null;
    });
}

function prepararControlesDepoimentos() {
    if (botaoDepAnterior) {
        botaoDepAnterior.addEventListener("click", () => {
            animarTrocaDireta("anterior");
            reiniciarRotacaoAutomatica();
        });
    }

    if (botaoDepProximo) {
        botaoDepProximo.addEventListener("click", () => {
            animarTrocaDireta("proximo");
            reiniciarRotacaoAutomatica();
        });
    }
}

const paletaSelect = document.getElementById("paleta");
const classeTema = {
    energia: "",
    oceano: "theme-oceano",
    vulcao: "theme-vulcao"
};

function aplicarTema(nomeTema) {
    document.body.classList.remove("theme-oceano", "theme-vulcao");

    const classe = classeTema[nomeTema] || "";
    if (classe) {
        document.body.classList.add(classe);
    }
}

if (paletaSelect) {
    const temaSalvo = localStorage.getItem("tema-site") || "energia";
    paletaSelect.value = temaSalvo;
    aplicarTema(temaSalvo);

    paletaSelect.addEventListener("change", (event) => {
        const tema = event.target.value;
        aplicarTema(tema);
        localStorage.setItem("tema-site", tema);
    });
}

function ativarReveal() {
    const elementosReveal = document.querySelectorAll(".reveal, .reveal-item");

    if (!("IntersectionObserver" in window)) {
        elementosReveal.forEach((el) => el.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.14,
        rootMargin: "0px 0px -40px 0px"
    });

    elementosReveal.forEach((el) => {
        if (!el.classList.contains("is-visible")) {
            observer.observe(el);
        }
    });
}

async function carregarDepoimentos() {
    try {
        const resposta = await fetch("./depoimentos.json", { cache: "no-store" });
        if (!resposta.ok) {
            throw new Error("Falha ao carregar arquivo de depoimentos");
        }

        const dados = await resposta.json();
        todosDepoimentos = Array.isArray(dados) && dados.length > 0 ? dados : fallbackDepoimentos;
    } catch (error) {
        todosDepoimentos = fallbackDepoimentos;
    } finally {
        renderizarPaginaAtualDepoimentos();
        prepararControlesDepoimentos();
        prepararDragDepoimentos();
        iniciarRotacaoAutomatica();
        ativarReveal();
    }
}

carregarDepoimentos();