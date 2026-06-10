document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#parcel-checker-form");
  var results = document.querySelector("#parcel-results");
  var priceCheckedDate = "9 June 2026";

  var royalMailFormats = [
    { id: "letter", label: "Letter", maxWeight: 0.1, dimensions: [24, 16.5, 0.5] },
    { id: "large-letter", label: "Large Letter", maxWeight: 0.75, dimensions: [35.3, 25, 2.5] },
    { id: "tracked-large-letter", label: "Large Letter (Tracked only)", maxWeight: 1, dimensions: [35.3, 25, 2.5] },
    { id: "small-parcel", label: "Small Parcel", maxWeight: 2, dimensions: [45, 35, 16] },
    { id: "medium-parcel", label: "Medium Parcel", maxWeight: 20, dimensions: [61, 46, 46] }
  ];

  var royalMailPrices = {
    "letter": [
      { service: "Royal Mail 2nd Class", price: 0.91, aim: "2-3 working days", tracked: false },
      { service: "Royal Mail 1st Class", price: 1.80, aim: "Next working day aim", tracked: false }
    ],
    "large-letter": [
      { service: "Royal Mail 2nd Class", price: 1.55, aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 48", price: 2.85, aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 1st Class", price: 3.20, aim: "Next working day aim", tracked: false },
      { service: "Royal Mail Tracked 24", price: 3.80, aim: "Next working day aim", tracked: true }
    ],
    "tracked-large-letter": [
      { service: "Royal Mail Tracked 48", price: 2.85, aim: "2-3 working days", tracked: true },
      { service: "Royal Mail Tracked 24", price: 3.80, aim: "Next working day aim", tracked: true }
    ],
    "small-parcel": [
      { service: "Royal Mail Tracked 48", price: 3.65, aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 2nd Class", price: 3.95, aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 24", price: 4.65, aim: "Next working day aim", tracked: true },
      { service: "Royal Mail 1st Class", price: 5.15, aim: "Next working day aim", tracked: false }
    ],
    "medium-parcel": [
      { service: "Royal Mail Tracked 48", price: 5.55, aim: "2-3 working days", tracked: true },
      { service: "Royal Mail 2nd Class", price: 6.25, aim: "2-3 working days", tracked: false },
      { service: "Royal Mail Tracked 24", price: 6.55, aim: "Next working day aim", tracked: true },
      { service: "Royal Mail 1st Class", price: 7.35, aim: "Next working day aim", tracked: false }
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
      '<div class="postage-option-heading"><h4>' + option.service + '</h4><strong>From ' + money(option.price) + "</strong></div>" +
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
    var royalMailOptions = royalMailFormat ? royalMailPrices[royalMailFormat.id] : [];
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
        '<p class="source-note">Public online prices checked ' + priceCheckedDate + ". Royal Mail prices are starting prices effective from 7 April 2026; the final quote can vary by weight, service options, destination, and collection.</p>" +
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
