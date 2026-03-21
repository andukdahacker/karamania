(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);

  var sessionId = params.get('session');
  if (sessionId) {
    window.location.href = '/share.html?session=' + encodeURIComponent(sessionId);
    return;
  }

  var code = params.get('code');

  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isAndroid = /Android/i.test(navigator.userAgent);

  var codeDisplay = document.getElementById('party-code-display');
  var codeValue = document.getElementById('code-value');
  var openAppBtn = document.getElementById('open-app-btn');
  var storeButtons = document.getElementById('store-buttons');
  var storeDivider = document.getElementById('store-divider');
  var desktopMessage = document.getElementById('desktop-message');
  var codeInput = document.getElementById('code-input');
  var joinBtn = document.getElementById('join-btn');

  // Show party code if present in URL
  if (code) {
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
    if (code.length === 4) {
      codeValue.textContent = code;
      codeDisplay.classList.remove('hidden');
      codeInput.value = code;
      joinBtn.disabled = false;
      // Hide "OPEN IN APP" on desktop — custom scheme won't resolve
      if (!isIOS && !isAndroid) {
        openAppBtn.classList.add('hidden');
      }
    }
  }

  // Platform-specific store buttons
  if (isIOS || isAndroid) {
    storeButtons.classList.remove('hidden');
    storeDivider.classList.remove('hidden');
    if (isIOS) {
      document.getElementById('android-store-btn').classList.add('hidden');
    } else {
      document.getElementById('ios-store-btn').classList.add('hidden');
    }
  } else {
    desktopMessage.classList.remove('hidden');
    storeDivider.classList.remove('hidden');
  }

  function attemptDeepLink(partyCode) {
    var deepLinkUrl = 'karamania://join?code=' + encodeURIComponent(partyCode);
    window.location.href = deepLinkUrl;

    // If still visible after 2s, app not installed — show store buttons
    setTimeout(function () {
      if (!document.hidden && (isIOS || isAndroid)) {
        storeButtons.classList.remove('hidden');
        storeDivider.classList.remove('hidden');
      }
    }, 2000);
  }

  // "OPEN IN APP" button
  if (openAppBtn) {
    openAppBtn.addEventListener('click', function () {
      var c = codeValue.textContent;
      if (c && c.length === 4) {
        attemptDeepLink(c);
      }
    });
  }

  // Auto-uppercase and validate code input
  codeInput.addEventListener('input', function () {
    var val = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    codeInput.value = val;
    joinBtn.disabled = val.length !== 4;
  });

  // "JOIN" button
  joinBtn.addEventListener('click', function () {
    var val = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length === 4) {
      attemptDeepLink(val);
    }
  });
})();
