document.getElementById("ano").textContent = new Date().getFullYear();
document.documentElement.classList.add("js");

const depoimentosLista = document.getElementById("depoimentos-lista");
const depoimentosWrapper = depoimentosLista ? depoimentosLista.parentElement : null;
const botaoDepAnterior = document.getElementById("dep-prev");
const botaoDepProximo = document.getElementById("dep-next");
const ctaWhatsapp = document.getElementById("cta-whatsapp");
let whatsappFloatRoot = document.getElementById("whatsapp-float-root");

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

const fallbackWhatsappConfig = {
    numero: "5561986527228",
    mensagem: "Ola, quero comecar hoje",
    ctaPrincipal: {
        texto: "Quero comecar agora"
    },
    botaoFlutuante: {
        ariaLabel: "Falar no WhatsApp"
    }
};

function montarLinkWhatsapp(config) {
    const numero = String(config?.numero || "").replace(/\D/g, "");
    if (!numero) {
        return "https://wa.me/";
    }

    const mensagem = String(config?.mensagem || "").trim();
    const query = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
    return `https://wa.me/${numero}${query}`;
}

function atualizarCtaPrincipalWhatsapp(config, href) {
    if (!ctaWhatsapp) {
        return;
    }

    ctaWhatsapp.href = href;
    ctaWhatsapp.target = "_blank";
    ctaWhatsapp.rel = "noopener noreferrer";

    const texto = config?.ctaPrincipal?.texto;
    if (typeof texto === "string" && texto.trim()) {
        ctaWhatsapp.textContent = texto.trim();
    }
}

function renderizarBotaoFlutuanteWhatsapp(config, href) {
    if (!whatsappFloatRoot) {
        whatsappFloatRoot = document.getElementById("whatsapp-float-root");
    }

    if (!whatsappFloatRoot) {
        return;
    }

    const ariaLabel = config?.botaoFlutuante?.ariaLabel || "Falar no WhatsApp";
    const pathD = "M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.46 0 .08 5.38.08 11.99c0 2.11.55 4.16 1.6 5.97L0 24l6.2-1.62a11.9 11.9 0 0 0 5.86 1.5h.01c6.6 0 11.98-5.38 11.98-11.99 0-3.2-1.25-6.21-3.53-8.41Zm-8.45 18.37h-.01a9.93 9.93 0 0 1-5.07-1.39l-.36-.21-3.68.96.98-3.58-.24-.37a9.95 9.95 0 0 1-1.53-5.27c0-5.5 4.49-9.99 10-9.99 2.66 0 5.16 1.03 7.03 2.9a9.84 9.84 0 0 1 2.92 7.05c0 5.51-4.49 9.99-10.04 9.99Zm5.48-7.49c-.3-.15-1.77-.87-2.05-.96-.27-.1-.46-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.5.08-.76.37-.26.3-1 1-.97 2.42.03 1.42 1.03 2.79 1.17 2.98.15.2 2.02 3.09 4.9 4.33.69.3 1.23.48 1.65.62.7.22 1.33.19 1.83.11.56-.08 1.77-.72 2.02-1.41.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.56-.35Z";

    whatsappFloatRoot.innerHTML = "";

    const botao = document.createElement("a");
    botao.className = "whatsapp-float";
    botao.href = href;
    botao.target = "_blank";
    botao.rel = "noopener noreferrer";
    botao.setAttribute("aria-label", ariaLabel);

    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    botao.appendChild(svg);
    whatsappFloatRoot.appendChild(botao);
}

async function carregarConfiguracaoWhatsapp() {
    let config = fallbackWhatsappConfig;

    try {
        const resposta = await fetch("./whatsapp.json", { cache: "no-store" });
        if (!resposta.ok) {
            throw new Error("Falha ao carregar arquivo de WhatsApp");
        }

        const dados = await resposta.json();
        if (dados && typeof dados === "object") {
            config = {
                ...fallbackWhatsappConfig,
                ...dados,
                ctaPrincipal: {
                    ...fallbackWhatsappConfig.ctaPrincipal,
                    ...(dados.ctaPrincipal || {})
                },
                botaoFlutuante: {
                    ...fallbackWhatsappConfig.botaoFlutuante,
                    ...(dados.botaoFlutuante || {})
                }
            };
        }
    } catch (error) {
        config = fallbackWhatsappConfig;
    }

    const hrefWhatsapp = montarLinkWhatsapp(config);
    atualizarCtaPrincipalWhatsapp(config, hrefWhatsapp);
    renderizarBotaoFlutuanteWhatsapp(config, hrefWhatsapp);
}

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
carregarConfiguracaoWhatsapp();