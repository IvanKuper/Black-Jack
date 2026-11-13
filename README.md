# Black-Jack

A browser Blackjack game. Bet chips, hit, stand, double down and try to beat the dealer. Your chips and streak are saved in the browser.

## Play

No install needed. Open `index.html` in a browser.

## How to play

1. Enter a bet and press **Deal**.
2. **Hit** takes another card. **Stand** ends your turn and the dealer plays.
3. **Double** doubles your bet and takes one card.
4. **New round** starts again with the same chips. **Reset** clears your saved chips and streak.

## Project files

| File | What it is |
|---|---|
| `index.html` | Page layout and links |
| `app.js` | Game logic, dealing, scoring and saving state |
| `style.css` | Styling |
| `imgs/` | Card and table images |

## Notes

- Game state is stored in `localStorage` under the key `blackjack_state_v1`. Clear it, or press **Reset**, to start over.
- Fonts and Bootstrap load from the internet, so you need a connection the first time.
