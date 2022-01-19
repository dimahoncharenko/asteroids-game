const btn = document.querySelector<HTMLButtonElement>("#submit")!;
const textArea = document.querySelector<HTMLTextAreaElement>("#text")!;

let timeout: undefined | number;

btn.addEventListener("click", (e) => {
  e.preventDefault();
  clearTimeout(timeout);
  btn.disabled = true;
  textArea.disabled = true;
  btn.classList.add("is-submit");
});

btn.addEventListener("animationend", (e) => {
  btn.classList.remove("shake");
});

textArea.addEventListener("keyup", (e) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    btn.classList.add("shake");
  }, 1000);
});
