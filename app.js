(function () {
  "use strict";

  const SUITS = [
    { symbol: "♠", color: "black" },
    { symbol: "♥", color: "red" },
    { symbol: "♦", color: "red" },
    { symbol: "♣", color: "black" },
  ];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const STORAGE_KEY = "blackjack_state_v1";

  const els = {
    playerName: document.getElementById("player-name-el"),
    chips: document.getElementById("chips-el"),
    bet: document.getElementById("bet-el"),
    streak: document.getElementById("streak-el"),
    message: document.getElementById("message-el"),
    dealerHand: document.getElementById("dealer-hand-el"),
    playerHand: document.getElementById("player-hand-el"),
    dealerSum: document.getElementById("dealer-sum-el"),
    playerSum: document.getElementById("player-sum-el"),
    felt: document.getElementById("felt"),
    dealBtn: document.getElementById("deal-btn"),
    hitBtn: document.getElementById("hit-btn"),
    standBtn: document.getElementById("stand-btn"),
    doubleBtn: document.getElementById("double-btn"),
    newRoundBtn: document.getElementById("new-round-btn"),
    resetBtn: document.getElementById("reset-btn"),
    clearBetBtn: document.getElementById("clear-bet-btn"),
    betPanel: document.getElementById("bet-panel"),
    soundToggleBtn: document.getElementById("sound-toggle-btn"),
  };

  let state = {
    chips: 100,
    bet: 0,
    streak: 0,
    soundOn: true,
  };

  let deck = [];
  let playerHand = [];
  let dealerHand = [];
  let phase = "betting"; // betting | player | dealer | over

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.chips === "number") {
        state.chips = saved.chips;
        state.streak = saved.streak || 0;
        state.soundOn = saved.soundOn !== false;
      }
    } catch (e) {
      /* ignore corrupted storage */
    }
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chips: state.chips, streak: state.streak, soundOn: state.soundOn })
    );
  }

  function buildDeck() {
    const d = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        d.push({ rank, suit: suit.symbol, color: suit.color });
      }
    }
    // shuffle (Fisher-Yates)
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function drawCard() {
    if (deck.length < 4) deck = buildDeck();
    return deck.pop();
  }

  function cardValue(card) {
    if (card.rank === "A") return 11;
    if (card.rank === "J" || card.rank === "Q" || card.rank === "K") return 10;
    return parseInt(card.rank, 10);
  }

  function handValue(hand) {
    let sum = hand.reduce((acc, c) => acc + cardValue(c), 0);
    let aces = hand.filter((c) => c.rank === "A").length;
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }
    return sum;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand) === 21;
  }

  // ---------- Sound (Web Audio, no assets needed) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }
  function beep(freq, duration, type = "sine", gain = 0.15) {
    if (!state.soundOn) return;
    try {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      /* audio not available */
    }
  }
  const sounds = {
    deal: () => beep(320, 0.08, "triangle", 0.12),
    win: () => {
      beep(523, 0.12);
      setTimeout(() => beep(659, 0.12), 100);
      setTimeout(() => beep(784, 0.18), 200);
    },
    lose: () => beep(140, 0.35, "sawtooth", 0.1),
    push: () => beep(300, 0.2, "square", 0.08),
    chip: () => beep(900, 0.05, "square", 0.08),
  };

  // ---------- Rendering ----------
  function renderCard(card, faceDown, index) {
    const div = document.createElement("div");
    div.className = "card" + (card.color === "red" ? " red" : "");
    if (faceDown) div.classList.add("facedown");
    div.style.setProperty("--rot", `${(index % 2 === 0 ? -1 : 1) * (2 + index)}deg`);
    div.style.setProperty("--delay", `${index * 0.12}s`);
    if (!faceDown) {
      div.innerHTML = `
        <span class="corner">${card.rank}<br>${card.suit}</span>
        <span class="suit-center">${card.suit}</span>
        <span class="corner bottom">${card.rank}<br>${card.suit}</span>
      `;
    }
    return div;
  }

  function renderHands(revealDealer) {
    els.playerHand.innerHTML = "";
    playerHand.forEach((c, i) => els.playerHand.appendChild(renderCard(c, false, i)));

    els.dealerHand.innerHTML = "";
    dealerHand.forEach((c, i) => {
      const hideThis = !revealDealer && i === 1;
      els.dealerHand.appendChild(renderCard(c, hideThis, i));
    });

    els.playerSum.textContent = String(handValue(playerHand));
    els.dealerSum.textContent = revealDealer
      ? String(handValue(dealerHand))
      : dealerHand.length
      ? String(cardValue(dealerHand[0]))
      : "0";

    if (playerHand.length && handValue(playerHand) > 21) {
      els.playerHand.querySelectorAll(".card").forEach((c) => c.classList.add("busted"));
    }
    if (isBlackjack(playerHand)) {
      els.playerHand.querySelectorAll(".card").forEach((c) => c.classList.add("blackjack"));
    }
  }

  function bumpValue(el) {
    el.classList.remove("bump");
    // restart animation
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function updateHud() {
    els.chips.textContent = "$" + state.chips;
    els.bet.textContent = "$" + state.bet;
    els.streak.textContent = String(state.streak);
    bumpValue(els.chips);
    bumpValue(els.bet);
  }

  function setMessage(text) {
    els.message.textContent = text;
  }

  function flashTable() {
    els.felt.classList.remove("flash");
    void els.felt.offsetWidth;
    els.felt.classList.add("flash");
  }

  function setControlsForPhase() {
    const betting = phase === "betting";
    const playing = phase === "player";
    const over = phase === "over";

    els.betPanel.style.display = betting ? "flex" : "none";
    els.dealBtn.disabled = !betting || state.bet <= 0;
    els.clearBetBtn.disabled = !betting;

    els.hitBtn.disabled = !playing;
    els.standBtn.disabled = !playing;
    els.doubleBtn.disabled = !playing || playerHand.length !== 2 || state.chips < state.bet;
    els.newRoundBtn.disabled = !over;
  }

  // ---------- Game flow ----------
  function placeBet(amount) {
    if (phase !== "betting") return;
    if (amount > state.chips - state.bet) {
      sounds.lose();
      setMessage("Not enough chips for that bet.");
      return;
    }
    state.bet += amount;
    sounds.chip();
    updateHud();
    setControlsForPhase();
  }

  function clearBet() {
    if (phase !== "betting") return;
    state.bet = 0;
    updateHud();
    setControlsForPhase();
  }

  function deal() {
    if (phase !== "betting" || state.bet <= 0) return;
    if (deck.length < 15) deck = buildDeck();

    playerHand = [drawCard(), drawCard()];
    dealerHand = [drawCard(), drawCard()];
    phase = "player";

    sounds.deal();
    renderHands(false);
    setControlsForPhase();

    const pBJ = isBlackjack(playerHand);
    const dBJ = isBlackjack(dealerHand);

    if (pBJ || dBJ) {
      finishRound();
      return;
    }

    setMessage("Your move: Hit, Stand, or Double Down.");
  }

  function hit() {
    if (phase !== "player") return;
    playerHand.push(drawCard());
    sounds.deal();
    renderHands(false);

    const val = handValue(playerHand);
    if (val > 21) {
      setMessage("Busted! Over 21.");
      finishRound();
    } else if (val === 21) {
      setMessage("21! Standing automatically.");
      stand();
    } else {
      setMessage("Your move: Hit, Stand, or Double Down.");
    }
    setControlsForPhase();
  }

  function stand() {
    if (phase !== "player") return;
    phase = "dealer";
    setControlsForPhase();
    dealerPlay();
  }

  function doubleDown() {
    if (phase !== "player" || playerHand.length !== 2) return;
    if (state.chips < state.bet) return;
    state.bet *= 2;
    updateHud();
    playerHand.push(drawCard());
    sounds.deal();
    renderHands(false);

    if (handValue(playerHand) > 21) {
      setMessage("Busted after doubling down!");
      finishRound();
    } else {
      stand();
    }
  }

  function dealerPlay() {
    renderHands(true);
    const step = () => {
      const val = handValue(dealerHand);
      if (val < 17) {
        dealerHand.push(drawCard());
        sounds.deal();
        renderHands(true);
        setTimeout(step, 550);
      } else {
        setTimeout(finishRound, 350);
      }
    };
    setTimeout(step, 500);
  }

  function finishRound() {
    phase = "over";
    renderHands(true);

    const pVal = handValue(playerHand);
    const dVal = handValue(dealerHand);
    const pBJ = isBlackjack(playerHand);
    const dBJ = isBlackjack(dealerHand);
    const bet = state.bet;

    let result;
    if (pVal > 21) {
      result = "lose";
    } else if (pBJ && dBJ) {
      result = "push";
    } else if (pBJ) {
      result = "blackjack";
    } else if (dBJ) {
      result = "lose";
    } else if (dVal > 21) {
      result = "win";
    } else if (pVal > dVal) {
      result = "win";
    } else if (pVal < dVal) {
      result = "lose";
    } else {
      result = "push";
    }

    switch (result) {
      case "blackjack":
        state.chips += Math.round(bet * 1.5);
        state.streak = Math.max(0, state.streak) + 1;
        setMessage(`Blackjack! You win $${Math.round(bet * 1.5)}! 🥳`);
        sounds.win();
        flashTable();
        break;
      case "win":
        state.chips += bet;
        state.streak = Math.max(0, state.streak) + 1;
        setMessage(`You win $${bet}! 🎉`);
        sounds.win();
        flashTable();
        break;
      case "push":
        state.streak = 0;
        setMessage("Push — bet returned.");
        sounds.push();
        break;
      case "lose":
      default:
        state.chips -= bet;
        state.streak = 0;
        setMessage(pVal > 21 ? "Busted! You lose. 😭" : "Dealer wins. 😔");
        sounds.lose();
        break;
    }

    state.bet = 0;
    updateHud();
    saveState();
    setControlsForPhase();

    if (state.chips <= 0) {
      setTimeout(() => {
        setMessage("You're out of chips! Resetting to $100.");
        state.chips = 100;
        updateHud();
        saveState();
      }, 1200);
    }
  }

  function newRound() {
    if (phase !== "over") return;
    playerHand = [];
    dealerHand = [];
    phase = "betting";
    els.playerHand.innerHTML = "";
    els.dealerHand.innerHTML = "";
    els.playerSum.textContent = "0";
    els.dealerSum.textContent = "0";
    setMessage("Place your bet to start the round.");
    setControlsForPhase();
  }

  function resetChips() {
    state.chips = 100;
    state.bet = 0;
    state.streak = 0;
    phase = "betting";
    playerHand = [];
    dealerHand = [];
    els.playerHand.innerHTML = "";
    els.dealerHand.innerHTML = "";
    els.playerSum.textContent = "0";
    els.dealerSum.textContent = "0";
    setMessage("Chips reset. Place your bet to start.");
    updateHud();
    saveState();
    setControlsForPhase();
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    els.soundToggleBtn.innerHTML = state.soundOn
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
    saveState();
    if (state.soundOn) sounds.chip();
  }

  // ---------- Wire up ----------
  els.betPanel.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => placeBet(parseInt(chip.dataset.value, 10)));
  });
  els.clearBetBtn.addEventListener("click", clearBet);
  els.dealBtn.addEventListener("click", deal);
  els.hitBtn.addEventListener("click", hit);
  els.standBtn.addEventListener("click", stand);
  els.doubleBtn.addEventListener("click", doubleDown);
  els.newRoundBtn.addEventListener("click", newRound);
  els.resetBtn.addEventListener("click", resetChips);
  els.soundToggleBtn.addEventListener("click", toggleSound);

  document.addEventListener("keydown", (e) => {
    if (phase === "player") {
      if (e.key.toLowerCase() === "h") hit();
      if (e.key.toLowerCase() === "s") stand();
      if (e.key.toLowerCase() === "d") doubleDown();
    } else if (phase === "betting" && e.key === "Enter") {
      deal();
    } else if (phase === "over" && e.key === "Enter") {
      newRound();
    }
  });

  // ---------- Init ----------
  loadState();
  deck = buildDeck();
  els.soundToggleBtn.innerHTML = state.soundOn
    ? '<i class="fa-solid fa-volume-high"></i>'
    : '<i class="fa-solid fa-volume-xmark"></i>';
  updateHud();
  setControlsForPhase();
})();
