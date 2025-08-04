/*
 * Lightweight Observable implementation for MV3 options page
 * Replaces KnockoutJS dependency to avoid CSP violations
 */

"use strict";

// Simple observable implementation
function observable(initialValue) {
  let value = initialValue;
  let subscribers = [];

  function obs(newValue) {
    if (arguments.length === 0) {
      return value;
    }

    if (newValue !== value) {
      value = newValue;
      subscribers.forEach(callback => {
        try {
          callback(newValue);
        } catch (e) {
          console.error("Observable subscriber error:", e);
        }
      });
    }
    return obs;
  }

  obs.subscribe = function(callback) {
    subscribers.push(callback);
    // Return unsubscribe function
    return function() {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  };

  obs.peek = function() {
    return value;
  };

  return obs;
}

// Observable array implementation
function observableArray(initialArray) {
  let array = initialArray || [];
  let subscribers = [];

  function obsArray(newArray) {
    if (arguments.length === 0) {
      return array;
    }

    array = newArray || [];
    notifySubscribers();
    return obsArray;
  }

  function notifySubscribers() {
    subscribers.forEach(callback => {
      try {
        callback(array);
      } catch (e) {
        console.error("ObservableArray subscriber error:", e);
      }
    });
  }

  obsArray.subscribe = function(callback) {
    subscribers.push(callback);
    return function() {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  };

  obsArray.push = function(item) {
    array.push(item);
    notifySubscribers();
  };

  obsArray.remove = function(item) {
    const index = array.indexOf(item);
    if (index > -1) {
      array.splice(index, 1);
      notifySubscribers();
      return [item];
    }
    return [];
  };

  obsArray.splice = function(start, deleteCount, ...items) {
    const result = array.splice(start, deleteCount, ...items);
    notifySubscribers();
    return result;
  };

  obsArray.peek = function() {
    return array;
  };

  // Define length as a getter property instead of a function
  Object.defineProperty(obsArray, "length", {
    get: function() {
      return array.length;
    },
    configurable: true
  });

  return obsArray;
}

// Computed observable implementation
function pureComputed(computeFunction) {
  let value;
  let hasValue = false;
  let subscribers = [];

  function computed() {
    if (!hasValue) {
      try {
        value = computeFunction();
        hasValue = true;
      } catch (e) {
        console.error("Computed observable error:", e);
        value = undefined;
      }
    }
    return value;
  }

  computed.subscribe = function(callback) {
    subscribers.push(callback);
    return function() {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  };

  // Invalidate computed when dependencies change
  computed.invalidate = function() {
    if (hasValue) {
      hasValue = false;
      const newValue = computed();
      subscribers.forEach(callback => {
        try {
          callback(newValue);
        } catch (e) {
          console.error("Computed subscriber error:", e);
        }
      });
    }
  };

  return computed;
}

// KnockoutJS compatibility layer
window.ko = {
  observable: observable,
  observableArray: observableArray,
  pureComputed: pureComputed,

  // Apply bindings (simplified)
  applyBindings: function(viewModel, element) {
    element = element || document.body;

    // Store viewModel globally for custom binding handlers
    window._koViewModel = viewModel;

    // Find all elements with data-bind attributes
    const elements = element.querySelectorAll("[data-bind]");
    elements.forEach(el => {
      const binding = el.getAttribute("data-bind");
      processDataBind(el, binding, viewModel);
    });

    // Process custom binding handlers
    Object.keys(window.ko.bindingHandlers).forEach(handlerName => {
      const elements = element.querySelectorAll(`[data-bind*="${handlerName}:"]`);
      elements.forEach(el => {
        const binding = el.getAttribute("data-bind");
        if (binding.includes(`${handlerName}:`)) {
          processCustomBinding(el, handlerName, binding, viewModel);
        }
      });
    });
  },

  // Binding handlers (simplified implementations)
  bindingHandlers: {}
};

// Simplified data-bind processing
function processDataBind(element, binding, viewModel) {
  try {
    // Parse simple bindings like "text: property", "visible: property", etc.
    const bindings = binding.split(",").map(b => b.trim());

    bindings.forEach(bind => {
      const [bindType, expression] = bind.split(":").map(s => s.trim());

      switch (bindType) {
      case "text":
        updateTextBinding(element, expression, viewModel);
        break;
      case "visible":
        updateVisibleBinding(element, expression, viewModel);
        break;
      case "css":
        updateCssBinding(element, expression, viewModel);
        break;
      case "click":
        updateClickBinding(element, expression, viewModel);
        break;
      case "textInput":
        updateTextInputBinding(element, expression, viewModel);
        break;
      case "attr":
        updateAttrBinding(element, expression, viewModel);
        break;
      case "checked":
        updateCheckedBinding(element, expression, viewModel);
        break;
      case "enable":
        updateEnableBinding(element, expression, viewModel);
        break;
      case "priorityDropdown":
        updatePriorityDropdownBinding(element, expression, viewModel);
        break;
      case "aliasModal":
        updateAliasModalBinding(element, expression, viewModel);
        break;
      default:
        // Skip custom binding handlers, they're processed separately
        if (!window.ko.bindingHandlers[bindType]) {
          console.warn(`Unsupported binding type: ${bindType}`);
        }
      }
    });
  } catch (e) {
    console.error("Data-bind processing error:", e, binding);
  }
}

// Process custom binding handlers
function processCustomBinding(element, handlerName, binding, viewModel) {
  try {
    const handler = window.ko.bindingHandlers[handlerName];
    if (handler && handler.init) {
      // Extract the expression for this binding
      const bindings = binding.split(",").map(b => b.trim());
      const targetBinding = bindings.find(b => b.startsWith(`${handlerName}:`));

      if (targetBinding) {
        const expression = targetBinding.split(":")[1].trim();

        // Create valueAccessor function
        const valueAccessor = () => evaluateExpression(expression, viewModel);

        // Create bindingContext (simplified)
        const bindingContext = {
          $data: viewModel
        };

        handler.init(element, valueAccessor, {}, viewModel, bindingContext);
      }
    }
  } catch (e) {
    console.error("Custom binding error:", e, handlerName);
  }
}

function updateTextBinding(element, expression, viewModel) {
  try {
    const getValue = () => {
      // Handle conditional expressions like "$data.enabled() ? 'Disable' : 'Enable'"
      if (expression.includes("?")) {
        const parts = expression.split("?");
        const condition = parts[0].trim();
        const [trueValue, falseValue] = parts[1].split(":").map(s => s.trim().replace(/'/g, ""));

        const conditionResult = evaluateExpression(condition.replace("()", ""), viewModel);
        const result = typeof conditionResult === "function" ? conditionResult() : conditionResult;
        return result ? trueValue : falseValue;
      }

      // Handle expressions like "$data.alias().length > 0 ? $data.alias().length : 'None'"
      if (expression.includes("length")) {
        const aliasArray = evaluateExpression("alias", viewModel);
        if (aliasArray && typeof aliasArray === "function") {
          const length = aliasArray().length;
          return length > 0 ? length.toString() : "None";
        }
      }

      // Handle simple property access
      const value = evaluateExpression(expression, viewModel);
      return typeof value === "function" ? value() : value;
    };

    const updateText = () => {
      element.textContent = getValue();
    };

    updateText();

    // Subscribe to changes if it's an observable
    const baseProperty = expression.split("(")[0].replace(/\$data\./, "");
    const observable = evaluateExpression(baseProperty, viewModel);
    if (observable && typeof observable.subscribe === "function") {
      observable.subscribe(updateText);
    }
  } catch (e) {
    console.error("Text binding error:", e);
  }
}

function updateVisibleBinding(element, expression, viewModel) {
  try {
    const getValue = () => {
      const value = evaluateExpression(expression, viewModel);
      return typeof value === "function" ? value() : value;
    };

    const updateVisibility = () => {
      const visible = getValue();
      element.style.display = visible ? "" : "none";
    };

    updateVisibility();

    // Subscribe to changes if it's an observable
    const observable = evaluateExpression(expression, viewModel);
    if (observable && typeof observable.subscribe === "function") {
      observable.subscribe(updateVisibility);
    }
  } catch (e) {
    console.error("Visible binding error:", e);
  }
}

function updateAttrBinding(element, expression, viewModel) {
  try {
    // Parse attr binding like "{ id: 'modal-' + $data.sanitizedId }"
    // This is a simplified implementation
    if (expression.includes("modal-")) {
      const idValue = `modal-${viewModel.sanitizedId}`;
      element.setAttribute("id", idValue);
    }
  } catch (e) {
    console.error("Attr binding error:", e);
  }
}

function updateCssBinding(element, expression, viewModel) {
  try {
    // Handle css binding like "{ disabled: !$data.enabled() }"
    if (expression.includes("disabled")) {
      const getValue = () => {
        const enabled = evaluateExpression("enabled", viewModel);
        return typeof enabled === "function" ? !enabled() : !enabled;
      };

      const updateClass = () => {
        const shouldAddClass = getValue();
        if (shouldAddClass) {
          element.classList.add("disabled");
        } else {
          element.classList.remove("disabled");
        }
      };

      updateClass();

      // Subscribe to changes
      const observable = evaluateExpression("enabled", viewModel);
      if (observable && typeof observable.subscribe === "function") {
        observable.subscribe(updateClass);
      }
    } else if (expression.includes("selected")) {
      // Handle selected class binding
      const getValue = () => {
        const selectedTab = evaluateExpression("selectedTab", viewModel);
        const currentTab = expression.includes("sites") ? "sites" : "general";
        return typeof selectedTab === "function" ? selectedTab() === currentTab : selectedTab === currentTab;
      };

      const updateClass = () => {
        const shouldAddClass = getValue();
        if (shouldAddClass) {
          element.classList.add("selected");
        } else {
          element.classList.remove("selected");
        }
      };

      updateClass();

      // Subscribe to changes
      const observable = evaluateExpression("selectedTab", viewModel);
      if (observable && typeof observable.subscribe === "function") {
        observable.subscribe(updateClass);
      }
    }
  } catch (e) {
    console.error("CSS binding error:", e);
  }
}

function updateClickBinding(element, expression, viewModel) {
  try {
    element.addEventListener("click", (event) => {
      event.preventDefault();

      // Handle function calls in click bindings
      if (expression.includes("selectedTab(")) {
        // Extract the parameter
        const match = expression.match(/selectedTab\('(\w+)'\)/);
        if (match) {
          const tabName = match[1];
          const selectedTabFn = evaluateExpression("selectedTab", viewModel);
          if (typeof selectedTabFn === "function") {
            selectedTabFn(tabName);
          }
        }
      } else if (expression.includes("toggleSite()")) {
        const func = evaluateExpression("toggleSite", viewModel);
        if (typeof func === "function") {
          func.call(viewModel);
        }
      } else if (expression.includes("toggleNotifications()")) {
        const func = evaluateExpression("toggleNotifications", viewModel);
        if (typeof func === "function") {
          func.call(viewModel);
        }
      } else if (expression.includes("addAlias")) {
        const func = evaluateExpression("addAlias", viewModel);
        if (typeof func === "function") {
          func.call(viewModel);
        }
      } else if (expression.includes("removeAlias")) {
        // Handle $parent.removeAlias($index)
        const parentContext = viewModel; // Simplified
        const func = parentContext.removeAlias;
        if (typeof func === "function") {
          // Get index from the element's position
          const aliasElements = element.closest(".alias-list")?.querySelectorAll(".alias-item");
          const index = Array.from(aliasElements || []).indexOf(element.closest(".alias-item"));
          func.call(parentContext, () => index);
        }
      } else {
        const func = evaluateExpression(expression, viewModel);
        if (typeof func === "function") {
          func.call(viewModel, viewModel, event);
        }
      }
    });
  } catch (e) {
    console.error("Click binding error:", e);
  }
}

function updateTextInputBinding(element, expression, viewModel) {
  try {
    const observable = evaluateExpression(expression, viewModel);
    if (observable && typeof observable === "function") {
      // Set initial value
      element.value = observable() || "";

      // Update observable when input changes
      element.addEventListener("input", () => {
        observable(element.value);
      });

      // Update input when observable changes
      if (typeof observable.subscribe === "function") {
        observable.subscribe((newValue) => {
          if (element.value !== newValue) {
            element.value = newValue || "";
          }
        });
      }
    }
  } catch (e) {
    console.error("TextInput binding error:", e);
  }
}

// Simple expression evaluation (limited to property access)
function evaluateExpression(expression, context) {
  try {
    // Remove $data. prefix if present
    expression = expression.replace(/\$data\./g, "");

    // Handle simple property access
    const parts = expression.split(".");
    let result = context;

    for (const part of parts) {
      if (result && typeof result === "object") {
        result = result[part];
      } else {
        break;
      }
    }

    return result;
  } catch (e) {
    console.error("Expression evaluation error:", e, expression);
    return undefined;
  }
}

function updateCheckedBinding(element, expression, viewModel) {
  try {
    const observable = evaluateExpression(expression, viewModel);
    if (observable && typeof observable === "function") {
      // Set initial checked state
      element.checked = observable() || false;

      // Update observable when checkbox changes
      element.addEventListener("change", () => {
        observable(element.checked);
      });

      // Update checkbox when observable changes
      if (typeof observable.subscribe === "function") {
        observable.subscribe((newValue) => {
          element.checked = newValue || false;
        });
      }
    }
  } catch (e) {
    console.error("Checked binding error:", e);
  }
}

function updateEnableBinding(element, expression, viewModel) {
  try {
    const getValue = () => {
      const value = evaluateExpression(expression, viewModel);
      return typeof value === "function" ? value() : value;
    };

    const updateEnabled = () => {
      const enabled = getValue();
      element.disabled = !enabled;
    };

    updateEnabled();

    // Subscribe to changes if it's an observable
    const observable = evaluateExpression(expression, viewModel);
    if (observable && typeof observable.subscribe === "function") {
      observable.subscribe(updateEnabled);
    }
  } catch (e) {
    console.error("Enable binding error:", e);
  }
}

function updatePriorityDropdownBinding(element, expression, viewModel) {
  try {
    // This is a custom binding for priority dropdowns
    // For now, just treat it as a value binding
    const observable = evaluateExpression(expression, viewModel);
    if (observable && typeof observable === "function") {
      element.value = observable() || "1";

      element.addEventListener("change", () => {
        observable(element.value);
      });

      if (typeof observable.subscribe === "function") {
        observable.subscribe((newValue) => {
          element.value = newValue || "1";
        });
      }
    }
  } catch (e) {
    console.error("PriorityDropdown binding error:", e);
  }
}

function updateAliasModalBinding(element, expression, viewModel) {
  try {
    // This is a custom binding for alias modals
    // For now, just handle it as a simple attribute binding
    const value = evaluateExpression(expression, viewModel);
    if (value) {
      element.setAttribute("data-alias-modal", value);
    }
  } catch (e) {
    console.error("AliasModal binding error:", e);
  }
}
