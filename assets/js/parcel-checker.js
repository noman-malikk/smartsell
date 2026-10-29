document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#parcel-checker-form");
  var results = document.querySelector("#parcel-results");
  var royalMailPriceCheckedDate = "29 October 2026";
  var evriPriceCheckedDate = "9 June 2026";

  var royalMailFormats = [
    { id: "letter", label: "Letter", maxWeight: 0.1, dimensions: [24, 16.5, 0.5] },
    { id: "large-letter", label: "Large Letter", maxWeight: 0.75, dimensions: [35.3, 25, 2.5] },
    { id: "tracked-large-letter", label: "Large Letter (Tracked only)", maxWeight: 1, dimensions: [35.3, 25, 2.5] },
    { id: "small-parcel", label: "Small Parcel", maxWeight: 2, dimensions: [45, 35, 16] },
    { id: "medium-parcel", label: "Medium Parcel", maxWeight: 20, dimensions: [61, 46, 46] }
  ];

  // Public ONLINE tariff, effective 5 October 2026, checked 29 October 2026.
  // Source: https://www.royalmail.com/sites/royalmail.com/files/2026-10/online-price-guide-october-2026-v1.pdf
  // Pages 5–6. Each band is [inclusive maximum weight in kg, price in GBP].
  // Collection (50p per item), signature and other extras are excluded.
  var royalMailPrices = {
    "letter": [
      { service: "Royal Mail 2nd Class", bands: [[0.1, 0.91]], aim: "2-3 working days", tracked: false },
      { service: "Royal Mail 1st Class", bands: [[0.1, 1.80]], aim: "Next working day aim", tracked: false }
    ],
    "large-letter": [
      { service: "Royal Mail 2nd Class", bands: [[0.1, 1.55], [0.25, 1.90], [0.5, 2.40], [0.75, 2.70]], aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 48", bands: [[1, 2.90]], aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 1st Class", bands: [[0.1, 3.20], [0.25, 3.30], [0.5, 3.30], [0.75, 3.30]], aim: "Next working day aim", tracked: false },
      { service: "Royal Mail Tracked 24", bands: [[1, 3.90]], aim: "Next working day aim", tracked: true }
    ],
    "tracked-large-letter": [
      { service: "Royal Mail Tracked 48", bands: [[1, 2.90]], aim: "2-3 working days", tracked: true },
      { service: "Royal Mail Tracked 24", bands: [[1, 3.90]], aim: "Next working day aim", tracked: true }
    ],
    "small-parcel": [
      { service: "Royal Mail Tracked 48", bands: [[2, 3.75]], aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 2nd Class", bands: [[2, 4.40]], aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 24", bands: [[2, 4.80]], aim: "Next working day aim", tracked: true },
      { service: "Royal Mail 1st Class", bands: [[2, 5.70]], aim: "Next working day aim", tracked: false }
    ],
    "medium-parcel": [
      { service: "Royal Mail Tracked 48", bands: [[2, 5.70], [10, 7.55], [20, 12.25]], aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 2nd Class", bands: [[2, 7.00], [10, 9.00], [20, 13.70]], aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 24", bands: [[2, 6.75], [10, 8.80], [20, 14.30]], aim: "Next working day aim", tracked: true },
      { service: "Royal Mail 1st Class", bands: [[2, 8.20], [10, 10.40], [20, 16.40]], aim: "Next working day aim", tracked: false }
    ]
  };

  if (!form || !results) {
    return;
  }

  function getNumber(name) {
    return Number.parseFloat(form.elements.namedItem(name).value);
  }

  function money(value) {
    return "£" + value.toFixed(2);
  }

  function showError(message) {
    results.innerHTML = '<p class="error-message" role="alert">' + message + "</p>";
  }

  function fitsDimensions(dimensions, limits) {
    return dimensions.every(function (dimension, index) {
      return dimension <= limits[index];
    });
  }

  function getRoyalMailFormat(dimensions, weight) {
    return royalMailFormats.find(function (format) {
      return weight <= format.maxWeight && fitsDimensions(dimensions, format.dimensions);
    }) || null;
  }

  function getDimensionOnlyFormat(dimensions) {
    return royalMailFormats.find(function (format) {
      return fitsDimensions(dimensions, format.dimensions);
    }) || null;
  }

  function getRoyalMailOptions(format, weight) {
    if (!format) return [];
    return royalMailPrices[format.id].map(function (option) {
      var band = option.bands.find(function (entry) { return weight <= entry[0]; });
      return band ? { service: option.service, price: band[1], aim: option.aim, tracked: option.tracked } : null;
    }).filter(function (option) { return option !== null; }).sort(function (a, b) { return a.price - b.price; });
  }

  function getEvriDetails(dimensions, weight) {
    var largest = dimensions[0];
    var middle = dimensions[1];
    var smallest = dimensions[2];
    var lengthAndGirth = largest + (2 * (middle + smallest));
    var sizeEligible = largest <= 120 && lengthAndGirth < 245;
    var weightEligible = weight <= 15;
    var eligible = sizeEligible && weightEligible;
    var lockerEligible = weightEligible && fitsDimensions(dimensions, [62, 57, 39]);
    var postable = weight >= 0.25 && weight <= 1 && fitsDimensions(dimensions, [35, 23, 3]) && smallest >= 1;
    var price = null;
    var band = "";

    if (eligible && postable) {
      price = 2.70;
      band = "Postable under 1kg";
    } else if (eligible && weight <= 1) {
      price = 3.29;
      band = "Under 1kg";
    } else if (eligible && weight <= 2) {
      price = 4.79;
      band = "1kg to 2kg";
    } else if (eligible && weight <= 5) {
      price = 6.59;
      band = "2kg to 5kg";
    } else if (eligible && weight <= 10) {
      price = 6.68;
      band = "5kg to 10kg";
    } else if (eligible && weight <= 15) {
      price = 10.28;
      band = "10kg to 15kg";
    }

    return {
      eligible: eligible,
      sizeEligible: sizeEligible,
      weightEligible: weightEligible,
      lockerEligible: lockerEligible,
      postable: postable,
      lengthAndGirth: lengthAndGirth,
      price: price,
      band: band
    };
  }

  function royalMailOptionMarkup(option) {
    return '<article class="postage-option">' +
      '<div class="postage-option-heading"><h4>' + option.service + '</h4><strong>' + money(option.price) + "</strong></div>" +
      '<p>' + option.aim + " · " + (option.tracked ? "Tracked to delivery point" : "Not fully tracked") + "</p>" +
    "</article>";
  }

  function evriOptionMarkup(evri) {
    if (!evri.eligible) {
      var reason = !evri.weightEligible
        ? "Over Evri's 15kg maximum"
        : "Exceeds Evri's 120cm length or 245cm length-and-girth limit";

      return '<article class="postage-option postage-option-unavailable">' +
        '<div class="postage-option-heading"><h4>Evri Standard</h4><strong>Not eligible</strong></div>' +
        "<p>" + reason + ".</p>" +
      "</article>";
    }

    return '<article class="postage-option">' +
      '<div class="postage-option-heading"><h4>Evri Standard drop-off</h4><strong>' + money(evri.price) + "</strong></div>" +
      '<p>' + evri.band + " · Home or work delivery · Tracking included</p>" +
    "</article>";
  }

  function calculateParcel() {
    var length = getNumber("length");
    var width = getNumber("width");
    var height = getNumber("height");
    var weight = getNumber("weight");
    var values = [length, width, height, weight];

    if (values.some(function (value) { return !Number.isFinite(value) || value <= 0; })) {
      showError("Enter all three packed dimensions and a packed weight greater than zero.");
      return;
    }

    var dimensions = [length, width, height].sort(function (a, b) {
      return b - a;
    });
    var largest = dimensions[0];
    var middle = dimensions[1];
    var smallest = dimensions[2];
    var royalMailFormat = getRoyalMailFormat(dimensions, weight);
    var dimensionOnlyFormat = getDimensionOnlyFormat(dimensions);
    var evri = getEvriDetails(dimensions, weight);
    var royalMailOptions = getRoyalMailOptions(royalMailFormat, weight);
    var availablePrices = royalMailOptions.map(function (option) {
      return option.price;
    });

    if (evri.price !== null) {
      availablePrices.push(evri.price);
    }

    var lowestEstimate = availablePrices.length ? Math.min.apply(null, availablePrices) : null;
    var category;
    var statusClass;
    var categoryExplanation;

    if (royalMailFormat) {
      category = "Royal Mail " + royalMailFormat.label;
      statusClass = royalMailFormat.id === "medium-parcel" ? "status-warning" : "status-success";

      if (dimensionOnlyFormat && dimensionOnlyFormat.id !== royalMailFormat.id) {
        categoryExplanation = "Its dimensions fit " + dimensionOnlyFormat.label + ", but the packed weight moves it into " + royalMailFormat.label + ".";
      } else {
        categoryExplanation = "The packed size and weight fit Royal Mail's " + royalMailFormat.label + " limits.";
      }
    } else if (evri.eligible) {
      category = "Oversized for standard Royal Mail formats";
      statusClass = "status-warning";
      categoryExplanation = "It does not fit Royal Mail's Letter, Large Letter, Small Parcel, or Medium Parcel limits, but it is within Evri's published size and weight limits.";
    } else {
      category = "Oversized for Royal Mail and Evri";
      statusClass = "status-danger";
      categoryExplanation = "Compare specialist or large-parcel couriers and confirm their current limits before booking.";
    }

    var royalMailMarkup = royalMailOptions.length
      ? royalMailOptions.map(royalMailOptionMarkup).join("")
      : '<article class="postage-option postage-option-unavailable"><div class="postage-option-heading"><h4>Royal Mail standard formats</h4><strong>Not eligible</strong></div><p>Exceeds the standard 61 × 46 × 46cm or 20kg Medium Parcel limit.</p></article>';

    var evriFitText = evri.eligible
      ? "Eligible" + (evri.lockerEligible ? " · Locker-size eligible" : " · ParcelShop/courier only")
      : "Not eligible";

    results.innerHTML =
      '<div class="result-status ' + statusClass + '">' + categoryExplanation + "</div>" +
      '<dl class="result-grid">' +
        '<div class="result-item result-featured"><dt>Royal Mail format</dt><dd>' + (royalMailFormat ? royalMailFormat.label : "Oversized") + "</dd></div>" +
        '<div class="result-item result-featured"><dt>Lowest listed estimate</dt><dd>' + (lowestEstimate === null ? "Compare couriers" : "From " + money(lowestEstimate)) + "</dd></div>" +
        '<div class="result-item"><dt>Evri check</dt><dd>' + evriFitText + "</dd></div>" +
        '<div class="result-item"><dt>Packed weight</dt><dd>' + weight.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " kg</dd></div>" +
        '<div class="result-item"><dt>Sorted dimensions</dt><dd>' + largest.toFixed(1) + " × " + middle.toFixed(1) + " × " + smallest.toFixed(1) + " cm</dd></div>" +
        '<div class="result-item"><dt>Evri length + girth</dt><dd>' + evri.lengthAndGirth.toFixed(1) + " / 245 cm</dd></div>" +
      "</dl>" +
      '<div class="result-section postage-section"><h3>Estimated UK postage</h3>' +
        '<p class="source-note">Royal Mail public online prices checked ' + royalMailPriceCheckedDate + '. Rates effective from 5 October 2026, matched to your packed weight. Collection adds 50p per item; signature and other extras are excluded. Tracked prices include VAT; 1st and 2nd Class are VAT-exempt. <a href="https://www.royalmail.com/sites/royalmail.com/files/2026-10/online-price-guide-october-2026-v1.pdf" target="_blank" rel="noopener">Official online price guide</a>.</p>' +
        '<p class="source-note">Evri estimates last checked ' + evriPriceCheckedDate + '. These older prices may have changed. Confirm all prices and restrictions with the carrier before buying postage.</p>' +
        '<div class="postage-options">' + royalMailMarkup + evriOptionMarkup(evri) + "</div>" +
      "</div>" +
      '<div class="result-section"><h3>Before buying postage</h3><ul>' +
        "<li>Measure and weigh the parcel after it is fully packaged.</li>" +
        "<li>Round up rather than down if your scale or measurement is close to a limit.</li>" +
        "<li>Check compensation, prohibited items, destination surcharges, and the final carrier quote.</li>" +
      "</ul></div>";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    calculateParcel();
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      results.innerHTML = '<div class="result-placeholder"><p>Enter the packed size and weight, then select <strong>Check parcel size</strong>.</p></div>';
    }, 0);
  });
});
