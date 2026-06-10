document.addEventListener("DOMContentLoaded", function () {
  var builderForm = document.querySelector("#title-builder-form");
  var suggestionsPanel = document.querySelector("#title-suggestions");
  var checkerForm = document.querySelector("#title-checker-form");
  var titleInput = document.querySelector("#listing-title");
  var countDisplay = document.querySelector("#live-character-count");
  var results = document.querySelector("#title-results");
  var generatedSuggestions = [];

  if (!checkerForm || !titleInput || !countDisplay || !results) {
    return;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateCount() {
    var count = titleInput.value.length;
    var remaining = 80 - count;
    countDisplay.textContent = count + " characters · " +
      (remaining >= 0 ? remaining + " remaining" : Math.abs(remaining) + " over the 80-character maximum");
    countDisplay.classList.toggle("count-warning", remaining < 0);
  }

  function normaliseWords(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9@]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function findRepeatedWords(words) {
    var counts = {};

    words.forEach(function (word) {
      if (word.length > 2) {
        counts[word] = (counts[word] || 0) + 1;
      }
    });

    return Object.keys(counts).filter(function (word) {
      return counts[word] > 1;
    });
  }

  function analyseTitle(title) {
    var score = 100;
    var issues = [];
    var suggestions = [];
    var words = normaliseWords(title);
    var repeatedWords = findRepeatedWords(words);
    var weakTerms = ["wow", "amazing", "best", "cheap", "bargain", "l@@k", "must see"];
    var lowerTitle = title.toLowerCase();
    var foundWeakTerms = weakTerms.filter(function (term) {
      return lowerTitle.includes(term);
    });
    var lettersOnly = title.replace(/[^a-zA-Z]/g, "");
    var isAllCaps = lettersOnly.length >= 4 && lettersOnly === lettersOnly.toUpperCase();
    var symbolMatches = title.match(/[!#*]/g) || [];
    var hasTooManySymbols = symbolMatches.length >= 3 || /([!#*])\1{2,}/.test(title);
    var detailPattern = /\b(\d+|black|white|blue|red|green|grey|gray|pink|yellow|silver|gold|small|medium|large|xl|xxl|new|used|sealed|boxed|cotton|leather|wood|metal|plastic|compatible|inch|cm|mm|gb|tb|pack|pair|set)\b/i;
    var hasUsefulDetail = detailPattern.test(title);

    if (title.length > 80) {
      score -= 25;
      issues.push("The title is over eBay's 80-character maximum.");
      suggestions.push("Remove repeated or low-value wording so the most useful details fit within 80 characters.");
    }

    if (title.length < 40) {
      score -= 15;
      issues.push("The title is under 40 characters and may be missing searchable details.");
      suggestions.push("Consider adding accurate details such as brand, product type, size, colour, quantity, model, material, condition, or compatibility.");
    }

    if (repeatedWords.length) {
      score -= 10;
      issues.push("Repeated words found: " + repeatedWords.join(", ") + ".");
      suggestions.push("Use each important keyword once unless repetition is genuinely needed for clarity.");
    }

    if (hasTooManySymbols) {
      score -= 10;
      issues.push("The title contains too many attention-grabbing symbols.");
      suggestions.push("Remove groups such as !!!, ***, or ### to keep the title readable.");
    }

    if (isAllCaps) {
      score -= 10;
      issues.push("The title is written in all uppercase.");
      suggestions.push("Use normal title casing so the listing is easier to scan.");
    }

    if (foundWeakTerms.length) {
      score -= 10;
      issues.push("Weak or unnecessary wording found: " + foundWeakTerms.join(", ") + ".");
      suggestions.push("Replace sales language with factual product keywords buyers may search for.");
    }

    if (lowerTitle.includes("genuine")) {
      suggestions.push('Only use "genuine" when the claim is accurate and you can support it.');
    }

    if (!hasUsefulDetail) {
      score -= 10;
      issues.push("The title may be missing a specific detail such as a size, quantity, model, colour, material, or condition.");
      suggestions.push("Add only details that are true for the item. Do not guess product information.");
    }

    if (!repeatedWords.length && words.length > 14) {
      suggestions.push("Check that every word helps identify the item; long keyword lists can look like keyword stuffing.");
    }

    if (!issues.length) {
      suggestions.push("The title passes the basic checks. Put the strongest identifying words near the beginning.");
    }

    return {
      score: Math.max(0, score),
      issues: issues,
      suggestions: suggestions
    };
  }

  function listMarkup(items, emptyMessage) {
    if (!items.length) {
      return "<p>" + emptyMessage + "</p>";
    }

    return "<ul>" + items.map(function (item) {
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("") + "</ul>";
  }

  function checkTitle() {
    var title = titleInput.value.trim();

    if (!title) {
      results.innerHTML = '<p class="error-message" role="alert">Enter a product title before checking it.</p>';
      return;
    }

    var analysis = analyseTitle(title);
    var scoreClass = analysis.score >= 80 ? "status-success" : analysis.score >= 60 ? "status-warning" : "status-danger";
    var scoreSummary = analysis.score >= 80 ? "Strong basic title" : analysis.score >= 60 ? "Worth improving" : "Needs attention";

    results.innerHTML =
      '<div class="score-wrap">' +
        '<div class="score" aria-label="Score ' + analysis.score + ' out of 100">' + analysis.score + "</div>" +
        '<div><h2>' + scoreSummary + '</h2><p class="score-label">' + title.length + ' characters · ' + Math.max(0, 80 - title.length) + " remaining</p></div>" +
      "</div>" +
      '<div class="result-status ' + scoreClass + '">Score: ' + analysis.score + " out of 100</div>" +
      '<div class="result-section"><h3>Issues found</h3>' + listMarkup(analysis.issues, "No major issues found by these basic checks.") + "</div>" +
      '<div class="result-section"><h3>Suggestions</h3>' + listMarkup(analysis.suggestions, "Keep the title accurate, clear, and easy to scan.") + "</div>" +
      '<div class="result-section"><h3>Improved title tips</h3><p>Lead with the brand and product type, then add accurate details such as model, size, colour, material, quantity, condition, or compatibility. Avoid keyword stuffing and never add product details you have not verified.</p></div>';
  }

  function cleanFact(value) {
    return value
      .trim()
      .replace(/[!#*]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function getBuilderFacts() {
    var facts = {};

    ["productType", "brand", "model", "compatibility", "colour", "size", "material", "quantity", "condition", "feature"].forEach(function (name) {
      facts[name] = cleanFact(builderForm.elements[name].value);
    });

    return facts;
  }

  function addUniqueWords(titleWords, segment) {
    var existingWords = {};
    var connectorWords = {
      "and": true,
      "for": true,
      "of": true,
      "the": true,
      "to": true,
      "with": true
    };

    titleWords.forEach(function (word) {
      existingWords[word.toLowerCase()] = true;
    });

    var newWords = segment.split(/\s+/).filter(function (word) {
      var normalised = word.toLowerCase();
      return !existingWords[normalised] || connectorWords[normalised];
    });

    while (newWords.length && connectorWords[newWords[0].toLowerCase()]) {
      newWords.shift();
    }

    while (newWords.length && connectorWords[newWords[newWords.length - 1].toLowerCase()]) {
      newWords.pop();
    }

    newWords.forEach(function (word) {
      titleWords.push(word);
      existingWords[word.toLowerCase()] = true;
    });
  }

  function buildTitle(facts, order) {
    var titleWords = [];
    var factsThatDidNotFit = [];

    order.forEach(function (key) {
      if (!facts[key]) {
        return;
      }

      var candidateWords = titleWords.slice();
      addUniqueWords(candidateWords, facts[key]);

      if (candidateWords.length > titleWords.length && candidateWords.join(" ").length <= 80) {
        titleWords = candidateWords;
      } else {
        factsThatDidNotFit.push(facts[key]);
      }
    });

    factsThatDidNotFit.forEach(function (fact) {
      var words = fact.split(/\s+/);
      var minimumWords = /^\d/.test(words[0]) ? Math.min(3, words.length) : Math.min(2, words.length);

      for (var wordCount = words.length - 1; wordCount >= minimumWords; wordCount -= 1) {
        var candidateWords = titleWords.slice();
        addUniqueWords(candidateWords, words.slice(0, wordCount).join(" "));
        var addedWordCount = candidateWords.length - titleWords.length;

        if (addedWordCount >= minimumWords && candidateWords.join(" ").length <= 80) {
          titleWords = candidateWords;
          break;
        }
      }
    });

    return titleWords.join(" ").trim();
  }

  function createSuggestions(facts) {
    var variants = [
      {
        label: "Search-first",
        description: "Leads with brand and model before the product details.",
        order: ["brand", "model", "productType", "compatibility", "quantity", "size", "colour", "material", "feature", "condition"]
      },
      {
        label: "Product-first",
        description: "Leads with the item type for quick buyer scanning.",
        order: ["productType", "brand", "model", "feature", "compatibility", "colour", "size", "material", "quantity", "condition"]
      },
      {
        label: "Detail-rich",
        description: "Brings useful specifications forward while staying concise.",
        order: ["brand", "productType", "model", "colour", "material", "size", "quantity", "feature", "compatibility", "condition"]
      }
    ];
    var seen = {};

    return variants.map(function (variant) {
      var title = buildTitle(facts, variant.order);

      if (!title || seen[title.toLowerCase()]) {
        return null;
      }

      seen[title.toLowerCase()] = true;

      return {
        label: variant.label,
        description: variant.description,
        title: title,
        score: analyseTitle(title).score
      };
    }).filter(Boolean);
  }

  function renderSuggestions(suggestions) {
    if (!suggestions.length) {
      suggestionsPanel.innerHTML = '<p class="error-message" role="alert">Add more distinct product details so the builder can create a useful suggestion.</p>';
      return;
    }

    suggestionsPanel.innerHTML =
      '<div class="suggestions-heading">' +
        '<div><p class="tool-kicker">Smart suggestions</p><h3>Choose a title direction</h3></div>' +
        '<span class="fee-chip">Maximum 80 characters</span>' +
      "</div>" +
      '<div class="suggestion-list">' +
        suggestions.map(function (suggestion, index) {
          var scoreClass = suggestion.score >= 80 ? "suggestion-score-good" : suggestion.score >= 60 ? "suggestion-score-mid" : "suggestion-score-low";
          var remaining = 80 - suggestion.title.length;
          var characterStatus = remaining === 0 ? "Full" : remaining + " available";

          return '<article class="suggestion-card">' +
            '<div class="suggestion-meta"><span>' + escapeHtml(suggestion.label) + '</span><strong class="' + scoreClass + '">' + suggestion.score + "/100</strong></div>" +
            '<p class="suggestion-title">' + escapeHtml(suggestion.title) + "</p>" +
            '<p class="suggestion-description">' + escapeHtml(suggestion.description) + "</p>" +
            '<div class="suggestion-footer"><span>' + suggestion.title.length + " / 80 characters · " + characterStatus + '</span><div class="suggestion-actions">' +
              '<button class="suggestion-button" type="button" data-copy-suggestion="' + index + '">Copy</button>' +
              '<button class="suggestion-button suggestion-button-primary" type="button" data-use-suggestion="' + index + '">Use &amp; check</button>' +
            "</div></div>" +
          "</article>";
        }).join("") +
      "</div>" +
      '<p class="suggestion-disclaimer">Suggestions use as many verified details as fit within 80 characters. Add more accurate product facts if useful space remains, and check every claim before publishing.</p>';
  }

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }

    return new Promise(function (resolve, reject) {
      var temporaryInput = document.createElement("textarea");
      temporaryInput.value = value;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.appendChild(temporaryInput);
      temporaryInput.select();

      var copied = document.execCommand("copy");
      temporaryInput.remove();

      if (copied) {
        resolve();
      } else {
        reject(new Error("Copy command was not available."));
      }
    });
  }

  titleInput.addEventListener("input", updateCount);
  updateCount();

  checkerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    checkTitle();
  });

  checkerForm.addEventListener("reset", function () {
    window.setTimeout(function () {
      updateCount();
      results.innerHTML = '<div class="result-placeholder"><p>Enter a title and select <strong>Check title</strong> to see its score and suggestions.</p></div>';
      titleInput.focus();
    }, 0);
  });

  if (builderForm && suggestionsPanel) {
    builderForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var facts = getBuilderFacts();

      if (!facts.productType) {
        suggestionsPanel.innerHTML = '<p class="error-message" role="alert">Enter the product type before creating title suggestions.</p>';
        builderForm.elements.productType.focus();
        return;
      }

      generatedSuggestions = createSuggestions(facts);
      renderSuggestions(generatedSuggestions);
    });

    builderForm.addEventListener("reset", function () {
      window.setTimeout(function () {
        generatedSuggestions = [];
        suggestionsPanel.innerHTML = '<div class="result-placeholder"><span class="result-placeholder-icon" aria-hidden="true">Aa</span><p>Add a product type and any verified details to create title suggestions.</p></div>';
      }, 0);
    });

    suggestionsPanel.addEventListener("click", function (event) {
      var useButton = event.target.closest("[data-use-suggestion]");
      var copyButton = event.target.closest("[data-copy-suggestion]");

      if (useButton) {
        var useIndex = Number.parseInt(useButton.dataset.useSuggestion, 10);
        var selectedSuggestion = generatedSuggestions[useIndex];

        if (selectedSuggestion) {
          titleInput.value = selectedSuggestion.title;
          updateCount();
          checkTitle();
          document.querySelector("#checker-heading").scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      if (copyButton) {
        var copyIndex = Number.parseInt(copyButton.dataset.copySuggestion, 10);
        var copiedSuggestion = generatedSuggestions[copyIndex];

        if (copiedSuggestion) {
          copyText(copiedSuggestion.title).then(function () {
            var originalText = copyButton.textContent;
            copyButton.textContent = "Copied";
            window.setTimeout(function () {
              copyButton.textContent = originalText;
            }, 1200);
          }).catch(function () {
            copyButton.textContent = "Copy failed";
          });
        }
      }
    });
  }
});
