/* options.js — persist ZooPrep connection + delivery preference in sync storage. */

const fields = {
  deliveryMode: document.getElementById("deliveryMode"),
  zooprepBaseUrl: document.getElementById("zooprepBaseUrl"),
  zooprepToken: document.getElementById("zooprepToken"),
};
const saveBtn = document.getElementById("save");
const savedMsg = document.getElementById("saved");

async function load() {
  const cfg = await chrome.storage.sync.get({
    deliveryMode: "auto",
    zooprepBaseUrl: "",
    zooprepToken: "",
    zooprepRefreshToken: "",
  });
  fields.deliveryMode.value = cfg.deliveryMode;
  fields.zooprepBaseUrl.value = cfg.zooprepBaseUrl;
  fields.zooprepToken.value = cfg.zooprepToken;
  const connected = document.getElementById("connected");
  if (connected) connected.hidden = !(cfg.zooprepBaseUrl && cfg.zooprepRefreshToken);
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    deliveryMode: fields.deliveryMode.value,
    zooprepBaseUrl: fields.zooprepBaseUrl.value.trim(),
    zooprepToken: fields.zooprepToken.value.trim(),
  });
  savedMsg.hidden = false;
  setTimeout(() => (savedMsg.hidden = true), 1500);
});

load();
