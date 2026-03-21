(async function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session');

  if (!sessionId) {
    showError('No session specified');
    return;
  }

  // Set OG URL meta tag
  var ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    ogUrl.setAttribute('content', window.location.href);
  }

  // Platform detection
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var isAndroid = /Android/i.test(navigator.userAgent);

  // Configure store buttons
  if (isIOS) {
    document.getElementById('android-store-btn').classList.add('hidden');
  } else if (isAndroid) {
    document.getElementById('ios-store-btn').classList.add('hidden');
  }

  // Hide "Open in App" on desktop
  if (!isIOS && !isAndroid) {
    document.getElementById('open-app-btn').classList.add('hidden');
  }

  // Deep link handler
  var openAppBtn = document.getElementById('open-app-btn');
  if (openAppBtn) {
    openAppBtn.addEventListener('click', function () {
      var deepLinkUrl = 'karamania://session/' + encodeURIComponent(sessionId);
      window.location.href = deepLinkUrl;

      setTimeout(function () {
        if (!document.hidden && (isIOS || isAndroid)) {
          // App not installed — store buttons already visible
        }
      }, 2000);
    });
  }

  try {
    var response = await fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/share');
    if (!response.ok) {
      showError('Session not found');
      return;
    }
    var json = await response.json();
    renderSession(json.data);
  } catch (err) {
    showError('Check your internet connection and try again');
  }

  function showError(message) {
    document.getElementById('share-loading').classList.add('hidden');
    var errorEl = document.getElementById('share-error');
    errorEl.classList.remove('hidden');
    document.getElementById('share-error-message').textContent = message;
  }

  function renderSession(session) {
    // Venue name
    document.getElementById('share-venue').textContent = session.venueName || 'Karaoke Night';

    // Date
    var date = new Date(session.createdAt);
    document.getElementById('share-date').textContent = date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Duration
    var ms = session.stats.sessionDurationMs;
    var hours = Math.floor(ms / 3600000);
    var minutes = Math.floor((ms % 3600000) / 60000);
    var durationText = hours > 0 ? hours + 'h ' + minutes + 'm' : minutes + 'm';
    document.getElementById('share-duration').textContent = durationText;

    // Vibe
    document.getElementById('share-vibe').textContent = session.vibe || '';

    // Stats
    document.getElementById('share-song-count').textContent = session.stats.songCount;
    document.getElementById('share-participant-count').textContent = session.stats.participantCount;
    document.getElementById('share-reaction-count').textContent = session.stats.totalReactions;

    // Participants
    var participantsList = document.getElementById('share-participants-list');
    session.participants.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'share-participant';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'share-participant-name';
      nameSpan.textContent = p.displayName;
      el.appendChild(nameSpan);
      if (p.topAward) {
        var badge = document.createElement('span');
        badge.className = 'share-award-badge';
        badge.textContent = p.topAward;
        el.appendChild(badge);
      }
      participantsList.appendChild(el);
    });

    // Setlist
    var setlistEl = document.getElementById('share-setlist');
    session.setlist.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'share-setlist-item';
      var songInfo = document.createElement('div');
      songInfo.className = 'share-song-info';
      var titleSpan = document.createElement('span');
      titleSpan.className = 'share-song-title';
      titleSpan.textContent = item.title;
      var artistSpan = document.createElement('span');
      artistSpan.className = 'share-song-artist';
      artistSpan.textContent = item.artist;
      songInfo.appendChild(titleSpan);
      songInfo.appendChild(artistSpan);
      li.appendChild(songInfo);

      if (item.performerName) {
        var performer = document.createElement('span');
        performer.className = 'share-performer';
        performer.textContent = item.performerName;
        li.appendChild(performer);
      }
      if (item.awardTitle) {
        var award = document.createElement('span');
        award.className = 'share-award-chip';
        award.textContent = item.awardTitle;
        li.appendChild(award);
      }
      setlistEl.appendChild(li);
    });

    // Media gallery
    if (session.mediaUrls && session.mediaUrls.length > 0) {
      var mediaSection = document.getElementById('share-media-section');
      mediaSection.classList.remove('hidden');
      var grid = document.getElementById('share-media-grid');
      session.mediaUrls.forEach(function (url) {
        var img = document.createElement('img');
        img.src = url;
        img.loading = 'lazy';
        img.alt = 'Session moment';
        img.className = 'share-media-thumb';
        grid.appendChild(img);
      });
    }

    // Show content, hide loading
    document.getElementById('share-loading').classList.add('hidden');
    document.getElementById('share-content').classList.remove('hidden');
  }
})();
