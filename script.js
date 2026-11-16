const form = document.querySelector("#discovery");
const input = document.querySelector("#item");
const button = form.querySelector("button");
const status = document.querySelector("#status");
const exhibit = document.querySelector("#exhibit");
const heading = document.querySelector("#bug-name");
const preview = location.protocol === "file:";

document.querySelector("#preview").hidden = !preview;

const previewExhibit = {
  item: "鏡子",
  name: "鏡前彩排，開口當機",
  situation: "出門前對著鏡子練了三遍自我介紹，見到本人時只說出一句「嗨」。",
  symptom: "鏡子前台詞背得很熟，換成真人就讀不到了。",
  fix: "只練第一句，剩下的留給現場對話。",
};

async function discover(item) {
  if (preview) {
    if (item !== previewExhibit.item) {
      throw new Error("本機排版預覽請輸入「鏡子」。網站部署後可自由輸入日常用品。");
    }
    return previewExhibit;
  }

  let response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
      signal: AbortSignal.timeout(26000),
    });
  } catch {
    throw new Error("連線逾時或中斷，請再試一次。");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.exhibit) {
    throw new Error(result?.error || "目前無法生成展品，請稍後再試。");
  }
  return result.exhibit;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;

  const item = input.value.trim();
  if (!item) {
    status.textContent = "請先輸入一樣日常用品。";
    input.focus();
    return;
  }

  button.disabled = true;
  status.textContent = "正在生成展品…";
  try {
    const result = await discover(item);
    document.querySelector("#bug-item").textContent = result.item;
    heading.textContent = result.name;
    for (const field of ["situation", "symptom", "fix"]) {
      document.getElementById(field).textContent = result[field];
    }
    exhibit.hidden = false;
    status.textContent = "";
    if (input.value.trim() === item) heading.focus();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
