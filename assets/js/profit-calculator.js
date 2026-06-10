document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#profit-calculator-form");
  var results = document.querySelector("#profit-results");
  var regulatoryFeeRate = 0.0035;

  var feeSchedules = {
    "antiques": flatSchedule("Antiques", 10.9),
    "art": flatSchedule("Art", 10.9),
    "baby": flatSchedule("Baby", 10.9),
    "books": flatSchedule("Books, Comics & Magazines", 9.9),
    "business": flatSchedule("Business, Office & Industrial", 12.5),
    "cameras": flatSchedule("Cameras & Photography", 9.9),
    "clothes": flatSchedule("Clothes, Shoes & Accessories", 11.9),
    "coins": tieredSchedule("Coins", "10.9% up to £450, then 3%", [
      { upTo: 450, rate: 10.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "collectables": flatSchedule("Collectables", 10.9),
    "computers": flatSchedule("Computers, Tablets & Networking", 9.9),
    "crafts": flatSchedule("Crafts", 12.9),
    "dolls": flatSchedule("Dolls & Bears", 10.9),
    "event-tickets": flatSchedule("Event Tickets", 12.9),
    "films": flatSchedule("Films & TV", 9.9),
    "garden": flatSchedule("Garden & Patio", 10.9),
    "health": flatSchedule("Health & Beauty", 10.9),
    "holidays": tieredSchedule("Holidays & Travel", "7.9% up to £650, then 3%", [
      { upTo: 650, rate: 7.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "home": tieredSchedule("Home, Furniture & DIY", "11.9% up to £500, then 7.9%", [
      { upTo: 500, rate: 11.9 },
      { upTo: Infinity, rate: 7.9 }
    ], true),
    "jewellery": tieredSchedule("Jewellery & Watches", "14.9% up to £1,000, then 4%", [
      { upTo: 1000, rate: 14.9 },
      { upTo: Infinity, rate: 4 }
    ]),
    "mobile": flatSchedule("Mobile Phones & Communication", 9.9),
    "music": flatSchedule("Music", 9.9),
    "musical-instruments": flatSchedule("Musical Instruments & DJ Equipment", 10.9),
    "pet-supplies": flatSchedule("Pet Supplies", 12.9),
    "pottery": flatSchedule("Pottery, Ceramics & Glass", 10.9),
    "sound-vision": flatSchedule("Sound & Vision", 9.9),
    "sporting-goods": flatSchedule("Sporting Goods", 10.9),
    "sports-memorabilia": flatSchedule("Sports Memorabilia", 10.9),
    "stamps": flatSchedule("Stamps", 10.9),
    "toys-games": flatSchedule("Toys & Games", 10.9),
    "vehicle-parts": tieredSchedule("Vehicle Parts & Accessories", "9.5% up to £750, then 3%", [
      { upTo: 750, rate: 9.5 },
      { upTo: Infinity, rate: 3 }
    ]),
    "video-games": flatSchedule("Video Games & Consoles", 9.9),
    "wholesale": flatSchedule("Wholesale & Job Lots", 12.9),
    "everything-else": flatSchedule("Everything Else", 12.9),
    "nfts": flatSchedule("Eligible NFT subcategory", 5),
    "camera-equipment": tieredSchedule("Selected cameras and photography equipment", "6.9% up to £1,000, then 3%", [
      { upTo: 1000, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "handbags": tieredSchedule("Women's Bags & Handbags", "12.9% up to £800, then 7%", [
      { upTo: 800, rate: 12.9 },
      { upTo: Infinity, rate: 7 }
    ]),
    "trainers": {
      name: "Eligible men's or women's trainers",
      rateLabel: "11.9%, or 7% from £100 item price",
      maxRate: 11.9,
      calculateVariableFee: function (totalRevenue, sellingPrice) {
        return totalRevenue * (sellingPrice >= 100 ? 0.07 : 0.119);
      }
    },
    "collectables-reduced": flatSchedule("Eligible Collectables with reduced order fee", 10.9, true),
    "computer-equipment": tieredSchedule("Selected computer equipment", "6.9% up to £1,000, then 3%", [
      { upTo: 1000, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "hair-extensions": flatSchedule("Hair Extensions & Wigs", 11.9),
    "electronic-smoking": flatSchedule("Electronic Smoking, Parts & Accessories", 12.9),
    "home-appliances-tools": tieredSchedule("Home appliances and DIY tools", "6.9% up to £400, then 3%", [
      { upTo: 400, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ], true),
    "power-strips": tieredSchedule("Power Strips & Surge Protectors", "9.9% up to £250, then 7.9%", [
      { upTo: 250, rate: 9.9 },
      { upTo: Infinity, rate: 7.9 }
    ], true),
    "furniture-bath-plumbing": tieredSchedule("Furniture, Bath and selected Plumbing", "10.9% to £500, 7.9% to £1,000, then 3%", [
      { upTo: 500, rate: 10.9 },
      { upTo: 1000, rate: 7.9 },
      { upTo: Infinity, rate: 3 }
    ], true),
    "watches": tieredSchedule("Watches, Parts & Accessories", "12.9% up to £750, then 3%", [
      { upTo: 750, rate: 12.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "smartphones": tieredSchedule("Mobile & Smart Phones", "6.9% up to £1,000, then 3%", [
      { upTo: 1000, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "sound-equipment": tieredSchedule("Selected Sound & Vision equipment", "6.9% up to £1,000, then 3%", [
      { upTo: 1000, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "tents": tieredSchedule("Tents", "10.9% up to £250, then 7.9%", [
      { upTo: 250, rate: 10.9 },
      { upTo: Infinity, rate: 7.9 }
    ]),
    "vehicle-exceptions": tieredSchedule("Tyres, GPS and selected vehicle power tools", "6.9% up to £750, then 3%", [
      { upTo: 750, rate: 6.9 },
      { upTo: Infinity, rate: 3 }
    ]),
    "consoles": tieredSchedule("Video Game Consoles", "6.9% up to £400, then 2%", [
      { upTo: 400, rate: 6.9 },
      { upTo: Infinity, rate: 2 }
    ]),
    "memorials": flatSchedule("Memorials & Funerals", 11.9)
  };

  if (!form || !results) {
    return;
  }

  var currencyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function flatSchedule(name, rate, reducedLowOrderFee) {
    return {
      name: name,
      rateLabel: rate.toFixed(1).replace(".0", "") + "%",
      maxRate: rate,
      reducedLowOrderFee: Boolean(reducedLowOrderFee),
      calculateVariableFee: function (totalRevenue) {
        return totalRevenue * rate / 100;
      }
    };
  }

  function tieredSchedule(name, rateLabel, tiers, reducedLowOrderFee) {
    return {
      name: name,
      rateLabel: rateLabel,
      maxRate: Math.max.apply(null, tiers.map(function (tier) {
        return tier.rate;
      })),
      reducedLowOrderFee: Boolean(reducedLowOrderFee),
      calculateVariableFee: function (totalRevenue) {
        var fee = 0;
        var previousLimit = 0;

        tiers.forEach(function (tier) {
          if (totalRevenue <= previousLimit) {
            return;
          }

          var chargeableAmount = Math.min(totalRevenue, tier.upTo) - previousLimit;
          fee += chargeableAmount * tier.rate / 100;
          previousLimit = tier.upTo;
        });

        return fee;
      }
    };
  }

  function getNumber(name) {
    var rawValue = form.elements[name].value.trim();
    return rawValue === "" ? 0 : Number.parseFloat(rawValue);
  }

  function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function formatPercentage(value) {
    return value.toFixed(1) + "%";
  }

  function showError(message) {
    results.innerHTML = '<p class="error-message" role="alert">' + message + "</p>";
  }

  function getOrderFee(totalRevenue, schedule) {
    if (totalRevenue <= 10) {
      return schedule.reducedLowOrderFee ? 0.10 : 0.30;
    }

    return 0.40;
  }

  function calculateFees(sellingPrice, postageCharged, promotedPercentage, schedule) {
    var totalRevenue = sellingPrice + postageCharged;
    var categoryFee = roundCurrency(schedule.calculateVariableFee(totalRevenue, sellingPrice));
    var orderFee = getOrderFee(totalRevenue, schedule);
    var regulatoryFee = roundCurrency(totalRevenue * regulatoryFeeRate);
    var promotedFee = roundCurrency(totalRevenue * promotedPercentage / 100);
    var normalEbayFee = roundCurrency(categoryFee + orderFee + regulatoryFee);

    return {
      categoryFee: categoryFee,
      orderFee: orderFee,
      regulatoryFee: regulatoryFee,
      promotedFee: promotedFee,
      normalEbayFee: normalEbayFee
    };
  }

  function findPriceInRange(start, end, targetProfit, profitAtPrice) {
    if (end < start || profitAtPrice(end) < targetProfit) {
      return null;
    }

    if (profitAtPrice(start) >= targetProfit) {
      return start;
    }

    var low = start;
    var high = end;

    for (var iteration = 0; iteration < 80; iteration += 1) {
      var middle = (low + high) / 2;

      if (profitAtPrice(middle) >= targetProfit) {
        high = middle;
      } else {
        low = middle;
      }
    }

    var price = Math.ceil(high * 100) / 100;

    while (profitAtPrice(price) < targetProfit) {
      price = roundCurrency(price + 0.01);
    }

    while (price >= 0.01 && profitAtPrice(roundCurrency(price - 0.01)) >= targetProfit) {
      price = roundCurrency(price - 0.01);
    }

    return price;
  }

  function findSellingPrice(targetProfit, values, baseCosts, schedule) {
    var profitAtPrice = function (sellingPrice) {
      var fees = calculateFees(sellingPrice, values.postageCharged, values.promotedPercentage, schedule);
      return sellingPrice + values.postageCharged - baseCosts - fees.normalEbayFee - fees.promotedFee;
    };
    var lowOrderBoundary = Math.max(0, 10 - values.postageCharged);
    var candidates = [];
    var lowOrderCandidate = findPriceInRange(0, lowOrderBoundary, targetProfit, profitAtPrice);

    if (lowOrderCandidate !== null) {
      candidates.push(lowOrderCandidate);
    }

    var highOrderStart = lowOrderBoundary + 0.000001;
    var highOrderEnd = Math.max(20, baseCosts + targetProfit + values.postageCharged + 10);

    while (profitAtPrice(highOrderEnd) < targetProfit && highOrderEnd < 1000000) {
      highOrderEnd *= 2;
    }

    var highOrderCandidate = findPriceInRange(highOrderStart, highOrderEnd, targetProfit, profitAtPrice);

    if (highOrderCandidate !== null) {
      candidates.push(highOrderCandidate);
    }

    return candidates.length ? Math.min.apply(null, candidates) : null;
  }

  function updateResults() {
    var categoryKey = form.elements.ebayCategory.value;
    var schedule = feeSchedules[categoryKey];
    var values = {
      sellingPrice: getNumber("sellingPrice"),
      productCost: getNumber("productCost"),
      postageCharged: getNumber("postageCharged"),
      actualPostage: getNumber("actualPostage"),
      packagingCost: getNumber("packagingCost"),
      promotedPercentage: getNumber("promotedPercentage"),
      otherCosts: getNumber("otherCosts"),
      targetProfit: getNumber("targetProfit")
    };

    var hasInvalidValue = Object.keys(values).some(function (key) {
      return !Number.isFinite(values[key]) || values[key] < 0;
    });

    if (hasInvalidValue) {
      showError("Please enter valid numbers of zero or more in every field.");
      return;
    }

    if (!schedule) {
      results.innerHTML = '<div class="result-placeholder"><span class="result-placeholder-icon" aria-hidden="true">%</span><p>Choose the closest eBay category to apply its business seller fee rate.</p></div>';
      return;
    }

    if (values.sellingPrice === 0 && values.postageCharged === 0) {
      results.innerHTML = '<div class="result-placeholder"><span class="result-placeholder-icon" aria-hidden="true">£</span><p>Enter a selling price or buyer postage amount to see a live estimate.</p></div>';
      return;
    }

    if ((schedule.maxRate + values.promotedPercentage + regulatoryFeeRate * 100) >= 100) {
      showError("The promoted listing percentage is too high when combined with this category's eBay fees.");
      return;
    }

    var totalRevenue = values.sellingPrice + values.postageCharged;
    var fees = calculateFees(values.sellingPrice, values.postageCharged, values.promotedPercentage, schedule);
    var baseCosts = values.productCost + values.actualPostage + values.packagingCost + values.otherCosts;
    var totalCosts = baseCosts + fees.normalEbayFee + fees.promotedFee;
    var profit = totalRevenue - totalCosts;
    var profitMargin = profit / totalRevenue * 100;
    var breakEvenPrice = findSellingPrice(0, values, baseCosts, schedule);
    var recommendedPrice = findSellingPrice(values.targetProfit, values, baseCosts, schedule);

    if (breakEvenPrice === null || recommendedPrice === null) {
      showError("A break-even price could not be estimated with these fee settings.");
      return;
    }

    var statusClass = "status-danger";
    var statusText = "Loss warning: your estimated costs are equal to or higher than your revenue.";

    if (profit > 0 && profitMargin >= 20) {
      statusClass = "status-success";
      statusText = "Healthy estimate: this sale has a positive profit and a margin of at least 20%.";
    } else if (profit > 0) {
      statusClass = "status-warning";
      statusText = "Low margin warning: this sale is profitable, but the estimated margin is below 20%.";
    }

    results.innerHTML =
      '<div class="result-heading"><div><p class="tool-kicker">Live estimate</p><h3>Your sale snapshot</h3></div><span class="fee-chip">' + schedule.rateLabel + "</span></div>" +
      '<div class="selected-category"><span>Fee category</span><strong>' + schedule.name + "</strong></div>" +
      '<div class="result-status ' + statusClass + '">' + statusText + "</div>" +
      '<dl class="result-grid">' +
        '<div class="result-item result-featured"><dt>Estimated profit</dt><dd>' + formatCurrency(profit) + "</dd></div>" +
        '<div class="result-item result-featured"><dt>Profit margin</dt><dd>' + formatPercentage(profitMargin) + "</dd></div>" +
        '<div class="result-item"><dt>Total revenue</dt><dd>' + formatCurrency(totalRevenue) + "</dd></div>" +
        '<div class="result-item"><dt>Total costs</dt><dd>' + formatCurrency(totalCosts) + "</dd></div>" +
        '<div class="result-item result-highlight"><dt>Estimated normal eBay fee</dt><dd>' + formatCurrency(fees.normalEbayFee) + "</dd></div>" +
        '<div class="result-item"><dt>Category percentage fee</dt><dd>' + formatCurrency(fees.categoryFee) + "</dd></div>" +
        '<div class="result-item"><dt>Per-order fee</dt><dd>' + formatCurrency(fees.orderFee) + "</dd></div>" +
        '<div class="result-item"><dt>Regulatory fee (0.35%)</dt><dd>' + formatCurrency(fees.regulatoryFee) + "</dd></div>" +
        '<div class="result-item"><dt>Promoted listing fee</dt><dd>' + formatCurrency(fees.promotedFee) + "</dd></div>" +
        '<div class="result-item"><dt>Break-even selling price</dt><dd>' + formatCurrency(breakEvenPrice) + "</dd></div>" +
        '<div class="result-item"><dt>Price for ' + formatCurrency(values.targetProfit) + ' target profit</dt><dd>' + formatCurrency(recommendedPrice) + "</dd></div>" +
      "</dl>" +
      '<ul class="result-notes">' +
        "<li>The normal eBay fee combines the category percentage fee, per-order fee, and regulatory operating fee.</li>" +
        "<li>Promoted listing fees and your entered product, postage, packaging, listing, and other costs are added separately.</li>" +
        "<li>Fee tables can change and some seller performance, international, tax, discount, or listing conditions are not included.</li>" +
      "</ul>";
  }

  form.addEventListener("input", updateResults);
  form.addEventListener("change", updateResults);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    updateResults();
  });

  form.addEventListener("reset", function () {
    window.setTimeout(function () {
      updateResults();
    }, 0);
  });
});
