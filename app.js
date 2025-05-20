
      });
    });
  });
  return allBids;
}

// --------- UTILITY ---------
function formatMoney(n) {
  return '₹' + n.toLocaleString('en-IN');
}
function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  let s = Math.floor(ms/1000);
  let m = Math.floor(s/60);
  s = s%60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}
function showToast(msg, success = true) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (success ? '' : ' error');
  setTimeout(() => toast.className = 'toast', 2100);
}
function showModal(content, noOverlay = false) {
  const modal = document.getElementById('modal');
  modal.innerHTML = content;
  modal.classList.remove('hidden');
  if (!noOverlay) {
    document.getElementById('modalOverlay').classList.remove('hidden');
  }
  document.body.style.overflow = "hidden";
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = "";
}
function switchPage(showLeaderboard) {
  document.getElementById('carGrid').classList.toggle('hidden', showLeaderboard);
  document.getElementById('leaderboardPage').classList.toggle('hidden', !showLeaderboard);
}

// --------- THEME HANDLING ---------
const themeKey = 'cars24_theme';
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(themeKey, theme);
  document.getElementById('modeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const current = localStorage.getItem(themeKey) || 'light';
  setTheme(current === 'light' ? 'dark' : 'light');
}

// --------- AUTH ---------
function renderAuthModal(isLogin = true) {
  showModal(`
    <button class="close-modal" onclick="closeModal()">&times;</button>
    <form class="auth-form" id="authForm">
      <h2>${isLogin ? 'Login' : 'Register'}</h2>
      <input type="text" id="auth_username" placeholder="Username" required minlength="3" />
      <input type="password" id="auth_password" placeholder="Password" required minlength="4" />
      <button type="submit">${isLogin ? 'Login' : 'Register'}</button>
      <button type="button" class="switch-link" id="switchAuth">${isLogin ? 'No account? Register' : 'Already have an account? Login'}</button>
    </form>
  `);
  document.getElementById('switchAuth').onclick = () => {
    renderAuthModal(!isLogin);
  };
  document.getElementById('authForm').onsubmit = (e) => {
    e.preventDefault();
    const username = document.getElementById('auth_username').value.trim();
    const password = document.getElementById('auth_password').value;
    if (isLogin) {
      const users = getUsers();
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        setCurrentUser({ username, watchlist: user.watchlist || [] });
        closeModal();
        updateAuthBtns();
        showToast("Login successful!");
      } else {
        showToast("Invalid credentials.", false);
      }
    } else {
      let users = getUsers();
      if (users.find(u => u.username === username)) {
        showToast("Username already exists.", false);
        return;
      }
      users.push({ username, password, watchlist: [] });
      setUsers(users);
      setCurrentUser({ username, watchlist: [] });
      closeModal();
      updateAuthBtns();
      showToast("Registration successful!");
    }
  };
}

// --------- ADMIN ADD CAR ---------
function renderAddCarModal() {
  showModal(`
    <button class="close-modal" onclick="closeModal()">&times;</button>
    <form id="addCarForm" class="auth-form">
      <h2>Add New Car</h2>
      <input required name="title" placeholder="Car Title"/>
      <input required name="brief" placeholder="Brief"/>
      <textarea required name="specs" placeholder="Specs (key:value, comma separated)"></textarea>
      <textarea required name="images" placeholder="Image URLs (comma separated)"></textarea>
      <input required name="basePrice" type="number" min="10000" step="1000" placeholder="Base Price"/>
      <button type="submit">Add Car</button>
    </form>
  `);
  document.getElementById('addCarForm').onsubmit = function(e){
    e.preventDefault();
    const fd = new FormData(this);
    const car = {
      id: 'car'+Date.now(),
      title: fd.get('title'),
      brief: fd.get('brief'),
      specs: Object.fromEntries(fd.get('specs').split(',').map(s=>s.split(':').map(x=>x.trim()))),
      images: fd.get('images').split(',').map(x=>x.trim()),
      auction: {
        start: Date.now() + 10000,
        end: Date.now() + 120000,
        basePrice: parseInt(fd.get('basePrice'), 10),
        bids: []
      }
    };
    let cars = getCars();
    cars.push(car);
    setCars(cars);
    closeModal();
    renderCarGrid();
    showToast("Car added!");
  };
}

// --------- WATCHLIST ---------
function getCurrentUserWithLiveWatchlist() {
  // Always sync watchlist from users database
  const user = getCurrentUser();
  if (!user) return null;
  const users = getUsers();
  const dbUser = users.find(u => u.username === user.username);
  return dbUser ? {...user, watchlist: dbUser.watchlist || []} : user;
}
function toggleWatch(carId) {
  let user = getCurrentUser();
  if (!user) { showToast("Login required", false); return; }
  let users = getUsers();
  let dbUser = users.find(u => u.username === user.username);
  dbUser.watchlist = dbUser.watchlist || [];
  if (dbUser.watchlist.includes(carId))
    dbUser.watchlist = dbUser.watchlist.filter(id => id !== carId);
  else
    dbUser.watchlist.push(carId);
  setUsers(users);
  setCurrentUser({ ...user, watchlist: dbUser.watchlist });
  renderCarGrid();
  showToast("Watchlist updated!");
}
function renderWatchlist() {
  switchPage(false);
  const user = getCurrentUserWithLiveWatchlist();
  const carGrid = document.getElementById('carGrid');
  if (!user || !user.watchlist || user.watchlist.length === 0) {
    carGrid.innerHTML = `<div style="margin:2em;font-size:1.2em;">Your watchlist is empty.</div>`;
    return;
  }
  const cars = getCars().filter(car => user.watchlist.includes(car.id));
  if (cars.length === 0) {
    carGrid.innerHTML = `<div style="margin:2em;font-size:1.2em;">Your watchlist is empty.</div>`;
    return;
  }
  carGrid.innerHTML = '';
  cars.forEach(car => {
    const now = Date.now();
    let auctionStatus = '';
    let countdown = '';
    if (now < car.auction.start) {
      auctionStatus = 'Auction not started';
      countdown = formatCountdown(car.auction.start - now);
    } else if (now >= car.auction.end) {
      auctionStatus = 'Auction ended';
      countdown = '00:00';
    } else {
      auctionStatus = 'Auction live';
      countdown = formatCountdown(car.auction.end - now);
    }
    let highestBid = car.auction.bids.length > 0
      ? car.auction.bids[car.auction.bids.length-1].amount
      : car.auction.basePrice;
    const isWatched = user && user.watchlist && user.watchlist.includes(car.id);
    const carouselId = `carousel-${car.id}`;
    carGrid.innerHTML += `
      <div class="car-card" data-car="${car.id}">
        <div class="carousel" id="${carouselId}">
          <button class="carousel-btn left" data-action="left">&#9664;</button>
          <img src="${car.images[0]}" alt="${car.title} image" draggable="false"/>
          <button class="carousel-btn right" data-action="right">&#9654;</button>
        </div>
        <div class="car-info">
          <div class="car-title">${car.title}</div>
          <div class="car-brief">${car.brief}</div>
          <div class="car-bid">Current Bid: <b>${formatMoney(highestBid)}</b></div>
          <div class="car-countdown">${auctionStatus}: <span class="countdown" data-car="${car.id}">${countdown}</span></div>
          <button class="view-btn" data-action="view" data-car="${car.id}">View Details</button>
          <button class="watch-btn ${isWatched ? 'active' : ''}" data-action="watch" data-car="${car.id}">
            ${isWatched ? 'Unwatch' : 'Watch'}
          </button>
        </div>
      </div>
    `;
    setTimeout(() => setupCarousel(car, carouselId), 0);
  });
}

// --------- HOMEPAGE GRID ---------
function renderCarGrid() {
  const carGrid = document.getElementById('carGrid');
  carGrid.innerHTML = '';
  const cars = getCars();
  const user = getCurrentUserWithLiveWatchlist();
  cars.forEach((car, idx) => {
    const now = Date.now();
    let auctionStatus = '';
    let countdown = '';
    if (now < car.auction.start) {
      auctionStatus = 'Auction not started';
      countdown = formatCountdown(car.auction.start - now);
    } else if (now >= car.auction.end) {
      auctionStatus = 'Auction ended';
      countdown = '00:00';
    } else {
      auctionStatus = 'Auction live';
      countdown = formatCountdown(car.auction.end - now);
    }
    let highestBid = car.auction.bids.length > 0
      ? car.auction.bids[car.auction.bids.length-1].amount
      : car.auction.basePrice;
    const isWatched = user && user.watchlist && user.watchlist.includes(car.id);
    // Carousel
    const carouselId = `carousel-${car.id}`;
    carGrid.innerHTML += `
      <div class="car-card" data-car="${car.id}">
        <div class="carousel" id="${carouselId}">
          <button class="carousel-btn left" data-action="left">&#9664;</button>
          <img src="${car.images[0]}" alt="${car.title} image" draggable="false"/>
          <button class="carousel-btn right" data-action="right">&#9654;</button>
        </div>
        <div class="car-info">
          <div class="car-title">${car.title}</div>
          <div class="car-brief">${car.brief}</div>
          <div class="car-bid">Current Bid: <b>${formatMoney(highestBid)}</b></div>
          <div class="car-countdown">${auctionStatus}: <span class="countdown" data-car="${car.id}">${countdown}</span></div>
          <button class="view-btn" data-action="view" data-car="${car.id}">View Details</button>
          <button class="watch-btn ${isWatched ? 'active' : ''}" data-action="watch" data-car="${car.id}">
            ${isWatched ? 'Unwatch' : 'Watch'}
          </button>
        </div>
      </div>
    `;
    setTimeout(() => setupCarousel(car, carouselId), 0);
  });
}

function setupCarousel(car, carouselId) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;
  let idx = 0;
  const img = carousel.querySelector('img');
  const leftBtn = carousel.querySelector('.carousel-btn.left');
  const rightBtn = carousel.querySelector('.carousel-btn.right');
  leftBtn.onclick = () => {
    idx = (idx - 1 + car.images.length) % car.images.length;
    img.src = car.images[idx];
  };
  rightBtn.onclick = () => {
    idx = (idx + 1) % car.images.length;
    img.src = car.images[idx];
  };
  img.onclick = () => { // Open modal with zoomed image
    showModal(`
      <button class="close-modal" onclick="closeModal()">&times;</button>
      <img src="${car.images[idx]}" style="max-width:95vw;max-height:88vh;display:block;margin:0 auto;border-radius:12px;" alt="Car image"/>
    `, true);
  };
}

// --------- CAR DETAILS & BIDDING ---------
function renderCarDetailModal(carId) {
  const car = getCars().find(c => c.id === carId);
  const user = getCurrentUserWithLiveWatchlist();
  const now = Date.now();
  let auctionStatus = '';
  let countdown = '';
  let isAuctionLive = false;
  if (now < car.auction.start) {
    auctionStatus = 'Auction not started';
    countdown = formatCountdown(car.auction.start - now);
  } else if (now >= car.auction.end) {
    auctionStatus = 'Auction ended';
    countdown = "00:00";
  } else {
    auctionStatus = 'Auction live';
    countdown = formatCountdown(car.auction.end - now);
    isAuctionLive = true;
  }
  let highestBid = car.auction.bids.length > 0
      ? car.auction.bids[car.auction.bids.length-1].amount
      : car.auction.basePrice;
  let leaderboardHTML = car.auction.bids.slice().reverse().slice(0, 5).map(bid =>
    `<li><b>${bid.user}</b>: ${formatMoney(bid.amount)} <span style="font-size:0.97em;color:#888;">(${new Date(bid.time).toLocaleTimeString()})</span></li>`
  ).join('') || '<li>No bids yet.</li>';

  // Photo gallery
  let galleryThumbs = car.images.map((img, idx) =>
    `<img src="${img}" class="${idx===0?'active':''}" data-idx="${idx}" alt="Thumb"/>`
  ).join('');
  const isWatched = user && user.watchlist && user.watchlist.includes(car.id);
  showModal(`
    <button class="close-modal" onclick="closeModal()">&times;</button>
    <h2>${car.title}</h2>
    <div class="gallery">
      <div class="gallery-main" id="galleryMain${car.id}">
        <img src="${car.images[0]}" alt="Main photo" id="galleryMainImg${car.id}" draggable="false" />
      </div>
      <div class="gallery-thumbs" id="galleryThumbs${car.id}">
        ${galleryThumbs}
      </div>
    </div>
    <div class="car-details">
      <ul>
        ${Object.entries(car.specs).map(([k,v])=>`<li><b>${k}:</b> ${v}</li>`).join('')}
      </ul>
    </div>
    <div class="car-bid" style="font-weight:500;font-size:1.13em;">
      Current Bid: <b>${formatMoney(highestBid)}</b>
      <span class="car-countdown" style="margin-left:1.2em;">${auctionStatus}: <span class="countdown" data-car="${car.id}">${countdown}</span></span>
    </div>
    <div class="live-leaderboard">
      <h4>Top Bidders</h4>
      <ul id="liveLB${car.id}">${leaderboardHTML}</ul>
    </div>
    <div class="bid-section">
      <form id="bidForm${car.id}">
        <input type="number" id="bidAmount${car.id}" min="${highestBid+1}" placeholder="Enter bid amount" required ${!isAuctionLive?"disabled":""} />
        <button type="submit" ${!isAuctionLive?"disabled":""}>Place Bid</button>
        <span class="bid-feedback" id="bidFeedback${car.id}"></span>
      </form>
    </div>
    <button class="watch-btn ${isWatched ? 'active' : ''}" id="modalWatchBtn" style="margin-top:1em;">
      ${isWatched ? 'Unwatch' : 'Watch'}
    </button>
    <div style="margin-top:1.2em;">
      <button onclick="closeModal()" class="view-btn" style="width:auto;min-width:120px;">Close</button>
    </div>
  `);

  // Gallery interactivity
  let currentImgIdx = 0;
  const mainImg = document.getElementById(`galleryMainImg${car.id}`);
  const thumbs = Array.from(document.querySelectorAll(`#galleryThumbs${car.id} img`));
  thumbs.forEach(thumb => {
    thumb.onclick = () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      currentImgIdx = +thumb.dataset.idx;
      mainImg.src = car.images[currentImgIdx];
    };
  });
  // Zoom main image
  mainImg.onclick = () => {
    showModal(`
      <button class="close-modal" onclick="closeModal()">&times;</button>
      <img src="${car.images[currentImgIdx]}" style="max-width:95vw;max-height:88vh;display:block;margin:0 auto;border-radius:12px;" alt="Car image"/>
    `, true);
  };

  // Bidding
  if (isAuctionLive) {
    document.getElementById(`bidForm${car.id}`).onsubmit = (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      if (!user) {
        showToast("Please login to bid.", false);
        renderAuthModal(true);
        return;
      }
      const amount = +document.getElementById(`bidAmount${car.id}`).value;
      let cars = getCars();
      let thisCar = cars.find(c => c.id === car.id);
      let currHighest = thisCar.auction.bids.length > 0
        ? thisCar.auction.bids[thisCar.auction.bids.length-1].amount
        : thisCar.auction.basePrice;
      if (isNaN(amount) || amount <= currHighest) {
        document.getElementById(`bidFeedback${car.id}`).textContent = "Bid must be higher than current bid.";
        document.getElementById(`bidFeedback${car.id}`).className = "bid-feedback error";
        return;
      }
      thisCar.auction.bids.push({
        user: user.username,
        amount,
        time: Date.now()
      });
      setCars(cars);
      document.getElementById(`bidFeedback${car.id}`).textContent = "Bid placed!";
      document.getElementById(`bidFeedback${car.id}`).className = "bid-feedback success";
      renderCarDetailModal(car.id);
      renderCarGrid();
      renderLeaderboardPage(); // Update leaderboard page too
    };
  } else {
    document.getElementById(`bidForm${car.id}`).onsubmit = e => e.preventDefault();
  }

  // Watchlist button in modal
  document.getElementById('modalWatchBtn').onclick = function() {
    toggleWatch(car.id);
    renderCarDetailModal(car.id);
  };
}

// --------- LIVE COUNTDOWNS ---------
setInterval(() => {
  // All countdowns on page
  document.querySelectorAll('.countdown[data-car]').forEach(span => {
    const carId = span.dataset.car;
    const car = getCars().find(c => c.id === carId);
    const now = Date.now();
    let ms;
    let txt;
    if (now < car.auction.start) {
      ms = car.auction.start - now;
      txt = formatCountdown(ms);
    } else if (now >= car.auction.end) {
      txt = "00:00";
    } else {
      ms = car.auction.end - now;
      txt = formatCountdown(ms);
    }
    span.textContent = txt;
    // If auction ends, re-render modals/buttons
    if (now >= car.auction.end) {
      renderCarGrid();
      renderLeaderboardPage();
      // If modal open for this car, update it
      const modal = document.getElementById('modal');
      if (!modal.classList.contains('hidden') && modal.innerHTML.includes(car.title)) {
        renderCarDetailModal(car.id);
      }
    }
  });
}, 900);

// --------- LEADERBOARD PAGE ---------
function renderLeaderboardPage() {
  // Populate car filter
  const cars = getCars();
  const filter = document.getElementById('carFilter');
  filter.innerHTML = `<option value="">All Cars</option>` +
    cars.map(car => `<option value="${car.id}">${car.title}</option>`).join('');
  // Get all bids
  let allBids = getLeaderBoardData();
  // Filter/sort
  const carId = filter.value;
  const sort = document.getElementById('sortLeaderboard').value;
  if (carId) allBids = allBids.filter(b => b.carId === carId);
  if (sort === 'highest') {
    allBids.sort((a, b) => b.amount - a.amount || b.time - a.time);
  } else {
    allBids.sort((a, b) => b.time - a.time);
  }
  // Table
  const tbody = document.querySelector('#leaderboardTable tbody');
  tbody.innerHTML = allBids.map(bid => `
    <tr>
      <td>${bid.carTitle}</td>
      <td>${bid.user}</td>
      <td>${formatMoney(bid.amount)}</td>
      <td>${new Date(bid.time).toLocaleTimeString()}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="text-align:center;">No bids yet.</td></tr>`;
}

// --------- AUTH BUTTONS & ADMIN/WATCHLIST NAV ---------
function updateAuthBtns() {
  const user = getCurrentUserWithLiveWatchlist();
  document.getElementById('loginBtn').style.display = user ? 'none' : '';
  document.getElementById('logoutBtn').style.display = user ? '' : 'none';
  document.getElementById('watchlistBtn').style.display = user ? '' : 'none';
  document.getElementById('addCarBtn').style.display = user && user.username === 'admin' ? '' : 'none';
}

// --------- EVENT LISTENERS ---------
window.onload = () => {
  // Theme
  setTheme(localStorage.getItem(themeKey) || 'light');
  document.getElementById('modeToggle').onclick = toggleTheme;
  // Auth
  updateAuthBtns();
  document.getElementById('loginBtn').onclick = () => renderAuthModal(true);
  document.getElementById('logoutBtn').onclick = () => {
    setCurrentUser(null);
    updateAuthBtns();
    showToast("Logged out!");
    renderCarGrid();
  };

  // Admin add car
  document.getElementById('addCarBtn').onclick = renderAddCarModal;

  // Watchlist nav
  document.getElementById('watchlistBtn').onclick = renderWatchlist;

  // Leaderboard nav
  document.getElementById('leaderboardBtn').onclick = () => {
    switchPage(true);
    renderLeaderboardPage();
  };
  document.getElementById('backToHomeLB').onclick = () => { switchPage(false); renderCarGrid(); };
  document.getElementById('carFilter').onchange = renderLeaderboardPage;
  document.getElementById('sortLeaderboard').onchange = renderLeaderboardPage;

  // Car grid events (delegated)
  document.getElementById('carGrid').onclick = (e) => {
    const btn = e.target.closest('.view-btn');
    if (btn) {
      renderCarDetailModal(btn.dataset.car);
      return;
    }
    const watchBtn = e.target.closest('.watch-btn');
    if (watchBtn) {
      toggleWatch(watchBtn.dataset.car);
      renderCarGrid();
      return;
    }
  };

  // Modal overlay click closes modal
  document.getElementById('modalOverlay').onclick = () => closeModal();

  renderCarGrid();
};

// --------- EXPORT FOR INLINE HANDLERS ---------
window.closeModal = closeModal;
window.renderAuthModal = renderAuthModal;
