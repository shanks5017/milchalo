/**
 * route.stitch - Precision Multi-Modal Transit Engine
 * Interlining Logic, Autocomplete, Pulsing Skeleton States, and Sidebar Filters
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. DOM ELEMENTS
  // ------------------------------------------------------------------------
  const searchForm = document.getElementById('route-search-form');
  const fromInput = document.getElementById('input-from');
  const toInput = document.getElementById('input-to');
  const dateInput = document.getElementById('input-date');
  const subtextFrom = document.getElementById('subtext-from');
  const subtextTo = document.getElementById('subtext-to');
  const swapBtn = document.getElementById('swap-locations-btn');
  const quickRouteChips = document.querySelectorAll('.route-chip');
  const searchTabs = document.querySelectorAll('.search-tab');
  
  // Search submit button elements
  const findRoutesBtn = document.getElementById('find-routes-btn');
  const searchBtnText = document.getElementById('search-btn-text');
  const searchBtnIcon = document.getElementById('search-btn-icon');

  // Autocomplete dropdowns
  const dropdownFrom = document.getElementById('dropdown-from');
  const dropdownTo = document.getElementById('dropdown-to');

  // Results & Loading Skeletons
  const resultsSection = document.getElementById('results-section');
  const resultsList = document.getElementById('results-list');
  const skeletonContainer = document.getElementById('skeleton-container');
  const emptyStateCard = document.getElementById('empty-state-card');
  const resultsCount = document.getElementById('results-count');
  const filterPills = document.querySelectorAll('.filter-pill');

  // Dynamic card labels
  const cardStitched1Origin = document.getElementById('card1-origin-name');
  const cardStitched1Dest = document.getElementById('card1-dest-name');
  const legOrigText = document.querySelector('.leg-orig-text');
  const legDestText = document.querySelector('.leg-dest-text');

  // Sidebar Filter Elements
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const emptyResetBtn = document.getElementById('empty-reset-btn');
  const transferRadios = document.querySelectorAll('input[name="filter-transfers"]');
  const modeCheckboxes = document.querySelectorAll('.checkbox-list input');
  const layoverRange = document.getElementById('layover-range');
  const layoverDisplay = document.getElementById('layover-display');
  const sortSelect = document.getElementById('sort-select');

  // Feedback console
  const consoleContainer = document.getElementById('console-feedback-container');
  const consoleOutput = document.getElementById('console-output');

  let originCode = null;
  let destCode = null;

  // Restore state from sessionStorage
  const savedState = sessionStorage.getItem('routeStitchSearchState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      if (state.fromInput && fromInput) fromInput.value = state.fromInput;
      if (state.toInput && toInput) toInput.value = state.toInput;
      if (state.dateInput && dateInput) dateInput.value = state.dateInput;
      if (state.originCode) originCode = state.originCode;
      if (state.destCode) destCode = state.destCode;
      if (state.subtextFrom && subtextFrom) subtextFrom.textContent = state.subtextFrom;
      if (state.subtextTo && subtextTo) subtextTo.textContent = state.subtextTo;
    } catch (e) {
      console.error('Failed to parse search state', e);
    }
  } else {
    // Set default departure date to tomorrow
    if (dateInput && !dateInput.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }
  }

  function saveSearchState() {
    const state = {
      fromInput: fromInput ? fromInput.value : '',
      toInput: toInput ? toInput.value : '',
      dateInput: dateInput ? dateInput.value : '',
      originCode: originCode,
      destCode: destCode,
      subtextFrom: subtextFrom ? subtextFrom.textContent : '',
      subtextTo: subtextTo ? subtextTo.textContent : ''
    };
    sessionStorage.setItem('routeStitchSearchState', JSON.stringify(state));
  }

  // Attach state saving listeners
  [fromInput, toInput, dateInput].forEach(el => {
    if (el) el.addEventListener('input', saveSearchState);
    if (el) el.addEventListener('change', saveSearchState);
  });

  // ------------------------------------------------------------------------
  // 2. AUTOCOMPLETE DROPDOWNS
  // ------------------------------------------------------------------------

  let allLocations = [];
  
  async function fetchLocations() {
    try {
      const response = await fetch('http://localhost:3002/api/locations');
      const data = await response.json();
      if (data.success && data.data) {
        allLocations = data.data;
        populateDropdowns(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch locations:', e);
    }
  }

  function createDropdownHTML(loc) {
    const searchTerms = (loc.searchStrings || []).join(' ').toLowerCase();
    return `
      <li class="dropdown-item" data-value="${loc.erailCode}" data-name="${loc.name}" data-search="${searchTerms}">
        <div class="dropdown-item-icon"><i class="fa-solid fa-train-subway"></i></div>
        <div class="dropdown-item-info">
          <span class="dropdown-item-title">${loc.name}</span>
          <span class="dropdown-item-sub">India (${loc.erailCode})</span>
        </div>
        <span class="dropdown-item-code">${loc.erailCode}</span>
      </li>
    `;
  }

  function populateDropdowns(locations) {
    const html = locations.map(createDropdownHTML).join('');
    const fromList = dropdownFrom.querySelector('.dropdown-list');
    const toList = dropdownTo.querySelector('.dropdown-list');
    if (fromList) fromList.innerHTML = html;
    if (toList) toList.innerHTML = html;
    
    setupAutocomplete(fromInput, dropdownFrom, subtextFrom, true);
    setupAutocomplete(toInput, dropdownTo, subtextTo, false);
  }

  function setupAutocomplete(inputEl, dropdownEl, subtextEl, isOrigin) {
    if (!inputEl || !dropdownEl) return;

    const items = dropdownEl.querySelectorAll('.dropdown-item');
    
    function filterAndShowDropdown(term) {
      if (term.length < 2) {
        dropdownEl.classList.remove('open');
        return;
      }
      
      let hasVisible = false;
      items.forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase();
        const code = item.getAttribute('data-value').toLowerCase();
        const search = item.getAttribute('data-search') || '';
        
        if (name.includes(term) || code.includes(term) || search.includes(term)) {
          item.style.display = 'flex';
          hasVisible = true;
        } else {
          item.style.display = 'none';
        }
      });
      
      if (hasVisible) {
        dropdownEl.classList.add('open');
      } else {
        dropdownEl.classList.remove('open');
      }
    }

    inputEl.addEventListener('focus', () => {
      closeAllDropdowns();
      filterAndShowDropdown(inputEl.value.toLowerCase().trim());
    });

    inputEl.addEventListener('input', (e) => {
      if (isOrigin) originCode = null;
      else destCode = null;
      
      filterAndShowDropdown(e.target.value.toLowerCase().trim());
    });
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mainVal = item.getAttribute('data-name');
        const code = item.getAttribute('data-value');

        if (mainVal) inputEl.value = mainVal;
        if (code && subtextEl) subtextEl.textContent = code;

        if (isOrigin) originCode = code;
        else destCode = code;

        items.forEach((i) => i.classList.remove('active'));
        item.classList.add('active');

        dropdownEl.classList.remove('open');
        saveSearchState();
      });
    });
  }

  function closeAllDropdowns() {
    if (dropdownFrom) dropdownFrom.classList.remove('open');
    if (dropdownTo) dropdownTo.classList.remove('open');
  }

  fetchLocations();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-group')) {
      closeAllDropdowns();
    }
  });

  // ------------------------------------------------------------------------
  // 3. LOCATION SWAP
  // ------------------------------------------------------------------------
  if (swapBtn && fromInput && toInput) {
    swapBtn.addEventListener('click', () => {
      const tempInput = fromInput.value;
      const tempSub = subtextFrom ? subtextFrom.textContent : '';
      const tempCode = originCode;

      fromInput.value = toInput.value;
      if (subtextFrom && subtextTo) subtextFrom.textContent = subtextTo.textContent;
      originCode = destCode;

      toInput.value = tempInput;
      if (subtextTo) subtextTo.textContent = tempSub;
      destCode = tempCode;

      toInput.value = tempInput;
      saveSearchState();
    });
  }

  // ------------------------------------------------------------------------
  // 4. QUICK ROUTE CHIPS
  // ------------------------------------------------------------------------
  quickRouteChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const fromVal = chip.getAttribute('data-from');
      const toVal = chip.getAttribute('data-to');
      const subFrom = chip.getAttribute('data-subfrom');
      const subTo = chip.getAttribute('data-subto');

      if (fromVal && fromInput) fromInput.value = fromVal;
      if (toVal && toInput) toInput.value = toVal;
      if (subFrom && subtextFrom) {
        subtextFrom.textContent = subFrom;
        originCode = subFrom;
      }
      if (subTo && subtextTo) {
        subtextTo.textContent = subTo;
        destCode = subTo;
      }
      
      saveSearchState();

      triggerSearchSubmit();
    });
  });

  function triggerSearchSubmit() {
    if (searchForm) {
      searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }

  // ------------------------------------------------------------------------
  // 5. SEARCH FORM SUBMISSION & PULSING SKELETON LOADING
  // ------------------------------------------------------------------------
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      closeAllDropdowns();

      const activeTab = document.querySelector('.search-tab.active');
      const searchMode = activeTab ? activeTab.dataset.mode || activeTab.textContent.trim() : 'Stitched Journeys';

      const rawDate = dateInput ? dateInput.value : '';
      let formattedDate = '';
      if (rawDate) {
        const [yyyy, mm, dd] = rawDate.split('-');
        formattedDate = `${dd}-${mm}-${yyyy}`;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        formattedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      }

      const extractCode = (str) => {
        if (!str) return '';
        // Look for code in parentheses like "India (SBC)"
        const parenMatch = str.match(/\(([a-zA-Z]{2,5})\)/);
        if (parenMatch) return parenMatch[1].toUpperCase();
        
        // Fallback to finding a 2-5 letter word
        const match = str.match(/\b([a-zA-Z]{2,5})\b/);
        return match ? match[1].toUpperCase() : str.trim().toUpperCase();
      };

      // Resolve location from user input if they didn't click the dropdown
      const resolveLocation = (inputValue, subtextValue, currentCode) => {
        if (currentCode) return currentCode;
        
        const val = inputValue.toLowerCase().trim();
        if (!val) return extractCode(subtextValue);
        
        // Find best match in allLocations
        const match = allLocations.find(loc => 
          loc.name.toLowerCase() === val || 
          loc.erailCode.toLowerCase() === val ||
          (loc.searchStrings && loc.searchStrings.some(s => s.toLowerCase() === val))
        ) || allLocations.find(loc => 
          loc.name.toLowerCase().includes(val) || 
          (loc.searchStrings && loc.searchStrings.some(s => s.toLowerCase().includes(val)))
        );
        
        if (match) {
          // Update the input field and subtext to reflect the resolved location
          if (inputValue === fromInput.value) {
            fromInput.value = match.name;
            if (subtextFrom) subtextFrom.textContent = `India (${match.erailCode})`;
          } else if (inputValue === toInput.value) {
            toInput.value = match.name;
            if (subtextTo) subtextTo.textContent = `India (${match.erailCode})`;
          }
          return match.erailCode;
        }
        return extractCode(subtextValue);
      };

      const fromCode = resolveLocation(fromInput.value, subtextFrom ? subtextFrom.textContent : '', originCode);
      const toCode   = resolveLocation(toInput.value, subtextTo ? subtextTo.textContent : '', destCode);
      if (!fromCode || !toCode) {
        if (consoleOutput) consoleOutput.textContent = '// Error: Could not determine station codes. Please select cities from the dropdown.';
        return;
      }

      const bufferInput = document.getElementById('input-buffer');
      const maxBufferMinutes = bufferInput && bufferInput.value ? parseInt(bufferInput.value, 10) : undefined;

      const payload = {
        mode: searchMode,
        from: fromCode,
        to: toCode,
        departureDate: formattedDate,
        maxBufferMinutes,
        timestamp: new Date().toISOString(),
        sessionId: Math.random().toString(36).substring(7)
      };

      if (consoleOutput && consoleContainer) {
        consoleOutput.textContent = `// Scraping rail & bus GDS endpoints...\nQuery Payload: ${JSON.stringify(payload, null, 2)}`;
        consoleContainer.classList.add('visible');
      }
      
      let evtSource = null;

      // Enter Loading State
      if (findRoutesBtn && searchBtnText) {
        findRoutesBtn.disabled = true;
        searchBtnText.textContent = 'Stitching Routes...';
        if (searchBtnIcon) {
          searchBtnIcon.outerHTML = `<div class="search-spinner" id="search-btn-icon"></div>`;
        }
      }

      // Hide results & empty state, show pulsing skeleton
      if (resultsList) resultsList.style.display = 'none';
      if (emptyStateCard) emptyStateCard.classList.remove('visible');
      if (skeletonContainer) skeletonContainer.classList.add('active');

      if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      try {
        if (consoleOutput) {
          evtSource = new EventSource(`http://localhost:3002/api/search/logs/${payload.sessionId}`);
          evtSource.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.message) {
                consoleOutput.textContent += `\n// ${data.message}`;
                if (consoleContainer) consoleContainer.scrollTop = consoleContainer.scrollHeight;
              }
            } catch (err) {}
          };
        }

        const response = await fetch('http://localhost:3002/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: payload.from,
            to: payload.to,
            date: payload.departureDate,
            mode: payload.mode,
            maxLegs: payload.mode === 'stitched' ? 3 : 1,
            maxBufferMinutes: payload.maxBufferMinutes,
            sessionId: payload.sessionId
          })
        });
        const result = await response.json();

        if (skeletonContainer) skeletonContainer.classList.remove('active');
        if (resultsList) resultsList.style.display = 'flex';
        
        if (result.success && result.data) {
           const directRoutes = (result.data.direct || []).map(r => ({
             legs: [r],
             totalDurationMins: (r.arrMins !== undefined && r.depMins !== undefined) ? (r.arrMins - r.depMins >= 0 ? r.arrMins - r.depMins : r.arrMins - r.depMins + 1440) : null,
             totalCostMin: r.lowestFare
           }));
           const stitchedRoutes = result.data.stitched || [];

           // In stitched mode: show stitched alternatives first, then direct.
           // In bus/train mode: only direct results (no stitched) — just show direct.
           let allRoutes;
           if (payload.mode === 'stitched') {
             allRoutes = [...stitchedRoutes, ...directRoutes];
           } else {
             allRoutes = directRoutes;
           }
           renderRoutes(allRoutes);
           if (consoleOutput) {
             consoleOutput.textContent = `// Interlining matrix generated successfully\nScrape Time: ${result.data.meta?.elapsedTime || 'N/A'}`;
           }
        } else {
           renderRoutes([]);
           if (consoleOutput) {
             const errMsg = result.error?.message || result.error || 'Unknown error';
             consoleOutput.textContent = `// Search failed: ${errMsg}`;
           }
        }
      } catch (e) {
         console.error("Search failed:", e);
         if (skeletonContainer) skeletonContainer.classList.remove('active');
         renderRoutes([]);
      } finally {
        if (evtSource) {
          evtSource.close();
        }
        // Reset submit button
        if (findRoutesBtn && searchBtnText) {
          findRoutesBtn.disabled = false;
          searchBtnText.textContent = 'Find Routes';
          const currentSpinner = document.getElementById('search-btn-icon');
          if (currentSpinner) {
            currentSpinner.outerHTML = `
              <svg class="search-submit-icon" id="search-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            `;
          }
        }
        applySidebarFilters();
      }
    });
  }

  function renderRoutes(routes) {
    if (!resultsList) return;
    resultsList.innerHTML = '';
    if (!routes || routes.length === 0) return;

    routes.forEach((route, index) => {
      const isDirect = route.legs.length === 1;
      // connectionType from backend e.g. 'train+bus', 'bus+train', 'train+train', 'bus+bus'
      // For direct routes (1 leg), derive it from the single leg's mode.
      const connectionType = route.connectionType
        || (isDirect ? (route.legs[0].mode || 'direct') : 'stitched');
      const type = isDirect ? 'direct' : 'stitched';
      
      const formatDuration = (mins) => {
        if (!mins) return 'N/A';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${String(m).padStart(2, '0')}m`;
      };

      const durationStr = route.totalDurationMins ? formatDuration(route.totalDurationMins) : (route.legs[0].travelTime || 'N/A');
      const price = route.totalCostMin || 140 + (index * 15);
      const originNode = route.legs[0].from;
      const destNode = route.legs[route.legs.length - 1].to;

      const transportSummaryItems = route.legs.map(leg => {
         const modeStr = leg.mode ? leg.mode.charAt(0).toUpperCase() + leg.mode.slice(1) : 'Unknown';
         const modeIcon = leg.mode === 'bus' ? '<i class="fa-solid fa-bus-simple"></i>' : '<i class="fa-solid fa-train-subway"></i>';
         return `<span class="leg-pill">${modeIcon} ${leg.from} → ${leg.to} <span style="font-weight: 500; margin-left: 4px; color: var(--color-text-secondary);">${modeStr}</span></span>`;
      });
      const transportSummary = transportSummaryItems.join(' <span class="leg-arrow"><i class="fa-solid fa-chevron-right"></i></span> ');

      let legsHtml = '';
      route.legs.forEach((leg, i) => {
        let legDuration = leg.travelTime;
        if (!legDuration && leg.arrMins && leg.depMins) {
           let diff = leg.arrMins - leg.depMins;
           if (diff < 0) diff += 24 * 60;
           legDuration = formatDuration(diff);
        }
        if (!legDuration) legDuration = 'N/A';

        if (leg.mode === 'train') {
          // Format running days
          const daysStr = "S M T W T F S"; 

          let availHtml = '';
          if (leg.availability && leg.availability.length > 0) {
            availHtml = leg.availability.map(av => {
              const statusStr = av.status || 'AVAILABLE';
              const statusClass = statusStr.toLowerCase().includes('regret') ? 'status-regret' : 'status-available';
              return `
                <div class="avail-card">
                  <div class="avail-header">
                    <span class="class-name">${av.class || 'Class'}</span>
                    <span class="class-price">${av.price || '₹0'}</span>
                  </div>
                  <div class="avail-status ${statusClass}">${statusStr}</div>
                  <div class="avail-footer">Free Cancellation</div>
                </div>
              `;
            }).join('');
          } else {
            availHtml = `<div class="avail-card"><div class="avail-status status-available">Availability Unknown</div></div>`;
          }

          legsHtml += `
            <div class="detailed-leg-card train-leg-card">
              <div class="leg-card-header">
                <div class="train-title-block">
                  <h3 class="train-name">${leg.trainName || leg.operator || 'Indian Railways'}</h3>
                  <div class="train-subinfo">
                    <span class="train-number">#${leg.trainNo || 'N/A'}</span>
                    <span class="train-days">Depart on: ${daysStr}</span>
                  </div>
                </div>
              </div>
              <div class="leg-card-times">
                <div class="time-block">
                  <span class="time-val">${leg.departure || 'N/A'}</span>
                  <span class="date-val">${leg.departureDate || ''}</span>
                  <span class="station-val">${leg.from}</span>
                </div>
                <div class="duration-block">
                  <span class="duration-val">${legDuration}</span>
                  <a href="#" class="view-route-link">View Route</a>
                </div>
                <div class="time-block right-align">
                  <span class="time-val">${leg.arrivalTime || 'N/A'}</span>
                  <span class="date-val">${leg.arrivalDate || ''}</span>
                  <span class="station-val">${leg.to}</span>
                </div>
              </div>
              <div class="availability-row">
                ${availHtml}
              </div>
              <div class="leg-card-footer">
                <span class="nearby-dates">Nearby dates ∨</span>
              </div>
            </div>
          `;
        } else if (leg.mode === 'bus') {
          legsHtml += `
            <div class="detailed-leg-card bus-leg-card">
              <div class="bus-top-row">
                <div class="bus-info-left">
                  <h3 class="operator-name">${leg.operator || 'Bus Operator'}</h3>
                  <span class="bus-type">${leg.busType || 'A/C Sleeper'}</span>
                </div>
                <div class="bus-times-center">
                  <div class="time-block">
                     <span class="time-val">${leg.departure || 'N/A'}</span>
                     <span class="date-val">${leg.departureDate || ''}</span>
                  </div>
                  <div class="bus-duration-wrap">
                     <span class="duration-line"></span>
                     <span class="duration-val">${legDuration}</span>
                     <span class="duration-line"></span>
                  </div>
                  <div class="time-block right-align">
                     <span class="time-val">${leg.arrivalTime || 'N/A'}</span>
                     <span class="date-val">${leg.arrivalDate || ''}</span>
                  </div>
                </div>
                <div class="bus-price-right">
                  <span class="price-val">₹${leg.lowestFare || 'N/A'}</span>
                </div>
              </div>
              <div class="bus-mid-row">
                ${leg.ratings ? `<div class="rating-badge">★ ${leg.ratings}</div>` : ''}
                <div class="seats-info">
                  ${leg.seatsLeft ? `<span class="seats-left">${leg.seatsLeft}</span>` : '<span class="seats-left">Seats Available</span>'}
                </div>
              </div>
              <div class="bus-bottom-row">
                <div class="bus-links">
                  <a href="#">Photos ∨</a>
                  <a href="#">Amenities ∨</a>
                  <a href="#">Pickup & Drop Points ∨</a>
                  <a href="#">Ratings & Reviews ∨</a>
                  <a href="#">Policies ∨</a>
                </div>
                <button class="select-seats-btn">SELECT SEATS</button>
              </div>
            </div>
          `;
        }

        if (i < route.legs.length - 1) {
          legsHtml += `
            <div class="timeline-interchange-banner">
              <div class="interchange-icon-box">🔄</div>
              <div class="interchange-details">
                <div class="interchange-title">
                  <span>Terminal Layover at ${leg.to}</span>
                  <span class="interchange-tag">Stitch Protection Active</span>
                </div>
              </div>
            </div>
          `;
        }
      });

      // Build badge title and icon based on actual connection type
      let routeTitle, badgeClass;
      if (isDirect) {
        const icon = connectionType === 'bus'
          ? '<i class="fa-solid fa-bus-simple"></i>'
          : '<i class="fa-solid fa-train-subway"></i>';
        routeTitle = `${icon} Direct`;
        badgeClass = 'badge-direct';
      } else {
        const iconMap = { train: '<i class="fa-solid fa-train-subway"></i>', bus: '<i class="fa-solid fa-bus-simple"></i>' };
        const parts = connectionType.split('+').map(m => iconMap[m] || m);
        routeTitle = parts.join(' + ');
        // Classify badge colour: hybrid vs same-mode
        const modes = connectionType.split('+');
        const allSame = modes.every(m => m === modes[0]);
        badgeClass = allSame ? (modes[0] === 'train' ? 'badge-train' : 'badge-bus') : 'badge-stitched';
      }

      const html = `
        <article class="route-card" data-type="${type}" data-connection="${connectionType}" data-price="${price}" data-duration="${route.totalDurationMins || 400}" id="route-card-${index}">
          <div class="card-badge-row">
            <div class="badge-group">
              <span class="badge ${badgeClass}">
                <span>${routeTitle}</span>
              </span>
            </div>
            <div class="card-price-block">
              <span class="price-label">Total Fare</span>
              <div>
                <span class="price-amount">₹${price}</span>
                <span class="price-currency">INR</span>
              </div>
            </div>
          </div>
          <div class="card-summary-row">
            <div class="summary-origin">
              <span class="summary-time">${route.legs[0].departure || 'N/A'}</span>
              <span class="summary-station">${originNode}</span>
            </div>
            <div class="summary-vector">
              <span class="vector-duration">${durationStr} Total</span>
              <div class="vector-line-container">
                <span class="vector-dot"></span>
                <div class="vector-line ${isDirect ? 'direct-line' : 'stitched-line'}">
                  ${!isDirect ? '<div class="vector-interchange-node"><span class="node-pulse"></span></div>' : ''}
                </div>
                <span class="vector-dot"></span>
              </div>
              <span class="vector-transits">${isDirect ? '0 Connections • Direct' : (route.legs.length - 1) + ' Connection(s)'}</span>
            </div>
            <div class="summary-destination">
              <span class="summary-time">${route.legs[route.legs.length - 1].arrivalTime || 'N/A'}</span>
              <span class="summary-station">${destNode}</span>
            </div>
          </div>
          
          <div class="route-legs-preview">
            ${transportSummary}
          </div>

          <div class="detailed-legs-container">
            ${legsHtml}
          </div>
          <button class="select-route-btn">Select This Itinerary</button>
        </article>
      `;
      resultsList.insertAdjacentHTML('beforeend', html);
    });
  }

  // Search Tabs Mode Switcher logic removed as we now use native link navigation.

  // ------------------------------------------------------------------------
  // 6. SIDEBAR FILTERS & SORTING
  // ------------------------------------------------------------------------
  function applySidebarFilters() {
    const selectedTransfer = document.querySelector('input[name="filter-transfers"]:checked')?.value || 'all';
    const activeHeaderFilter = document.querySelector('.filter-pill.active')?.getAttribute('data-filter') || 'all';
    const maxLayoverMinutes = layoverRange ? parseInt(layoverRange.value, 10) : 150;

    const cards = document.querySelectorAll('.route-card');
    let visibleCount = 0;

    // Helper: does a card's connectionType match the requested filter?
    function matchesFilter(card, filter) {
      if (filter === 'all') return true;
      const conn = card.getAttribute('data-connection') || '';
      const cardType = card.getAttribute('data-type') || '';
      if (filter === 'direct') return cardType === 'direct';
      if (filter === 'hybrid') {
        // Hybrid = mixed modes (train+bus or bus+train), not same-mode stitched
        const modes = conn.split('+');
        return modes.length >= 2 && !modes.every(m => m === modes[0]);
      }
      // Exact connectionType match for 'train+train', 'bus+bus', etc.
      return conn === filter;
    }

    cards.forEach((card) => {
      const cardType = card.getAttribute('data-type');
      let show = true;

      if (!matchesFilter(card, selectedTransfer)) show = false;
      if (!matchesFilter(card, activeHeaderFilter)) show = false;

      if (cardType === 'stitched' && maxLayoverMinutes < 85) {
        show = false;
      }

      if (show) {
        card.style.display = 'block';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (resultsCount) {
      resultsCount.textContent = `${visibleCount} Optimal ${visibleCount === 1 ? 'Route' : 'Routes'} Found`;
    }

    if (visibleCount === 0) {
      if (emptyStateCard) emptyStateCard.classList.add('visible');
      if (resultsList) resultsList.style.display = 'none';
    } else {
      if (emptyStateCard) emptyStateCard.classList.remove('visible');
      if (resultsList) resultsList.style.display = 'flex';
    }
  }

  // Layover Range Slider Live Display
  if (layoverRange && layoverDisplay) {
    layoverRange.addEventListener('input', () => {
      const mins = parseInt(layoverRange.value, 10);
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      layoverDisplay.textContent = hours > 0 ? `${hours}h ${remMins}m` : `${remMins}m`;
      applySidebarFilters();
    });
  }

  transferRadios.forEach((radio) => radio.addEventListener('change', applySidebarFilters));
  modeCheckboxes.forEach((cb) => cb.addEventListener('change', applySidebarFilters));

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');

      const filterVal = pill.getAttribute('data-filter');
      const matchingRadio = document.querySelector(`input[name="filter-transfers"][value="${filterVal}"]`);
      if (matchingRadio) matchingRadio.checked = true;

      applySidebarFilters();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const val = sortSelect.value;
      const cards = Array.from(document.querySelectorAll('.route-card'));

      cards.sort((a, b) => {
        const priceA = parseFloat(a.getAttribute('data-price') || '0');
        const priceB = parseFloat(b.getAttribute('data-price') || '0');
        const durationA = parseInt(a.getAttribute('data-duration') || '0', 10);
        const durationB = parseInt(b.getAttribute('data-duration') || '0', 10);

        if (val === 'price-asc') return priceA - priceB;
        if (val === 'duration-asc') return durationA - durationB;
        return 0;
      });

      cards.forEach((card) => resultsList.appendChild(card));
    });
  }

  function resetAllFilters() {
    const defaultRadio = document.querySelector('input[name="filter-transfers"][value="all"]');
    if (defaultRadio) defaultRadio.checked = true;

    modeCheckboxes.forEach((cb) => (cb.checked = true));

    if (layoverRange && layoverDisplay) {
      layoverRange.value = '150';
      layoverDisplay.textContent = '2h 30m';
    }

    filterPills.forEach((p) => p.classList.remove('active'));
    const allPill = document.querySelector('.filter-pill[data-filter="all"]');
    if (allPill) allPill.classList.add('active');

    if (sortSelect) sortSelect.value = 'recommended';

    applySidebarFilters();
  }

  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

  // ------------------------------------------------------------------------
  // 7. SELECT ROUTE BUTTON INTERACTIVITY
  // ------------------------------------------------------------------------
  document.querySelectorAll('.select-route-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const origText = btn.innerHTML;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Itinerary Selected</span>
      `;
      btn.classList.add('btn-accent');

      setTimeout(() => {
        btn.innerHTML = origText;
        btn.classList.remove('btn-accent');
      }, 2500);
    });
  });
});
