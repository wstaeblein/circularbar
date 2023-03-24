
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback, value) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            if (value === undefined) {
                callback(component.$$.ctx[index]);
            }
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\circularbar.svelte generated by Svelte v3.55.0 */
    const file$1 = "src\\circularbar.svelte";

    // (63:12) {#if info}
    function create_if_block(ctx) {
    	let br;
    	let t;
    	let div;

    	const block = {
    		c: function create() {
    			br = element("br");
    			t = space();
    			div = element("div");
    			add_location(br, file$1, 63, 16, 2437);
    			attr_dev(div, "class", "svelte-i2jjfw");
    			add_location(div, file$1, 64, 16, 2459);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, br, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);
    			div.innerHTML = /*info*/ ctx[0];
    			/*div_binding*/ ctx[17](div);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*info*/ 1) div.innerHTML = /*info*/ ctx[0];		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[17](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(63:12) {#if info}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let section;
    	let div1;
    	let svg;
    	let circle0;
    	let circle1;
    	let t0;
    	let div0;
    	let b0;
    	let t1;
    	let b1;
    	let t3;
    	let section_resize_listener;
    	let if_block = /*info*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			div1 = element("div");
    			svg = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			t0 = space();
    			div0 = element("div");
    			b0 = element("b");
    			t1 = text(/*newValue*/ ctx[3]);
    			b1 = element("b");
    			b1.textContent = "%";
    			t3 = space();
    			if (if_block) if_block.c();
    			attr_dev(circle0, "cx", /*radius*/ ctx[4]);
    			attr_dev(circle0, "cy", /*radius*/ ctx[4]);
    			attr_dev(circle0, "r", /*radius*/ ctx[4]);
    			attr_dev(circle0, "class", "svelte-i2jjfw");
    			add_location(circle0, file$1, 57, 12, 2078);
    			attr_dev(circle1, "cx", /*radius*/ ctx[4]);
    			attr_dev(circle1, "cy", /*radius*/ ctx[4]);
    			attr_dev(circle1, "r", /*radius*/ ctx[4]);
    			attr_dev(circle1, "color", /*color*/ ctx[1]);
    			attr_dev(circle1, "class", "svelte-i2jjfw");
    			add_location(circle1, file$1, 58, 12, 2172);
    			attr_dev(svg, "class", "svelte-i2jjfw");
    			add_location(svg, file$1, 56, 8, 2059);
    			add_location(b0, file$1, 61, 12, 2328);
    			add_location(b1, file$1, 61, 51, 2367);
    			attr_dev(div0, "class", "info svelte-i2jjfw");
    			add_location(div0, file$1, 60, 8, 2296);
    			attr_dev(div1, "class", "container svelte-i2jjfw");
    			add_location(div1, file$1, 55, 4, 2026);
    			attr_dev(section, "class", "circle svelte-i2jjfw");
    			add_render_callback(() => /*section_elementresize_handler*/ ctx[18].call(section));
    			add_location(section, file$1, 54, 0, 1947);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div1);
    			append_dev(div1, svg);
    			append_dev(svg, circle0);
    			/*circle0_binding*/ ctx[13](circle0);
    			append_dev(svg, circle1);
    			/*circle1_binding*/ ctx[14](circle1);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, b0);
    			append_dev(b0, t1);
    			/*b0_binding*/ ctx[15](b0);
    			append_dev(div0, b1);
    			/*b1_binding*/ ctx[16](b1);
    			append_dev(div0, t3);
    			if (if_block) if_block.m(div0, null);
    			section_resize_listener = add_resize_listener(section, /*section_elementresize_handler*/ ctx[18].bind(section));
    			/*section_binding*/ ctx[19](section);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle0, "cx", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle0, "cy", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle0, "r", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle1, "cx", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle1, "cy", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*radius*/ 16) {
    				attr_dev(circle1, "r", /*radius*/ ctx[4]);
    			}

    			if (dirty & /*color*/ 2) {
    				attr_dev(circle1, "color", /*color*/ ctx[1]);
    			}

    			if (dirty & /*newValue*/ 8) set_data_dev(t1, /*newValue*/ ctx[3]);

    			if (/*info*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			/*circle0_binding*/ ctx[13](null);
    			/*circle1_binding*/ ctx[14](null);
    			/*b0_binding*/ ctx[15](null);
    			/*b1_binding*/ ctx[16](null);
    			if (if_block) if_block.d();
    			section_resize_listener();
    			/*section_binding*/ ctx[19](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Circularbar', slots, []);
    	let { value = 0 } = $$props;
    	let { info = '' } = $$props;
    	let { color } = $$props;
    	let { thickness = 0 } = $$props;
    	let newValue; // Value already validated
    	let radius, side;
    	let circle, hidCircle;
    	let rootEle;
    	let rootWidth, rootHeight;
    	let textLarge, textSmall, percent;
    	let max = 100;

    	onMount(() => {
    		calculate();
    	});

    	function calculate() {
    		$$invalidate(3, newValue = (value > max ? max : value < 0 ? 0 : value) || 0);

    		if (circle) {
    			let border = !thickness ? rootWidth / 20 : +thickness;

    			// Discount the stroke thickness on both sides
    			side = rootWidth;

    			$$invalidate(4, radius = (side - border * 2) / 2);

    			if (color) {
    				rootEle.style.setProperty('--def-circlebar-color', color);
    			}

    			let dashValue = Math.round(2 * Math.PI * radius);
    			$$invalidate(5, circle.style.strokeDashoffset = dashValue, circle);
    			$$invalidate(5, circle.style.strokeDasharray = dashValue, circle);
    			$$invalidate(5, circle.style.strokeWidth = border, circle);
    			$$invalidate(5, circle.style.transform = `translate(${border}px, ${border}px)`, circle);
    			$$invalidate(6, hidCircle.style.strokeWidth = border, hidCircle);
    			$$invalidate(6, hidCircle.style.transform = `translate(${border}px, ${border}px)`, hidCircle);

    			// Value for dashoffset
    			$$invalidate(5, circle.style.strokeDashoffset = dashValue - dashValue * newValue / 100, circle);

    			// Font sizes
    			$$invalidate(8, textLarge.style.fontSize = Math.max(radius / 2, 12) + 'px', textLarge);

    			$$invalidate(9, textSmall.style.fontSize = Math.max(radius / 6, 6) + 'px', textSmall);
    			$$invalidate(9, textSmall.style.width = side * 0.7 + 'px', textSmall);
    			$$invalidate(10, percent.style.fontSize = Math.max(radius / 6, 10) + 'px', percent);
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (color === undefined && !('color' in $$props || $$self.$$.bound[$$self.$$.props['color']])) {
    			console.warn("<Circularbar> was created without expected prop 'color'");
    		}
    	});

    	const writable_props = ['value', 'info', 'color', 'thickness'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Circularbar> was created with unknown prop '${key}'`);
    	});

    	function circle0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			hidCircle = $$value;
    			$$invalidate(6, hidCircle);
    		});
    	}

    	function circle1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			circle = $$value;
    			$$invalidate(5, circle);
    		});
    	}

    	function b0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			textLarge = $$value;
    			$$invalidate(8, textLarge);
    		});
    	}

    	function b1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			percent = $$value;
    			$$invalidate(10, percent);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			textSmall = $$value;
    			$$invalidate(9, textSmall);
    		});
    	}

    	function section_elementresize_handler() {
    		rootWidth = this.clientWidth;
    		$$invalidate(2, rootWidth);
    	}

    	function section_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			rootEle = $$value;
    			$$invalidate(7, rootEle);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(11, value = $$props.value);
    		if ('info' in $$props) $$invalidate(0, info = $$props.info);
    		if ('color' in $$props) $$invalidate(1, color = $$props.color);
    		if ('thickness' in $$props) $$invalidate(12, thickness = $$props.thickness);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		value,
    		info,
    		color,
    		thickness,
    		newValue,
    		radius,
    		side,
    		circle,
    		hidCircle,
    		rootEle,
    		rootWidth,
    		rootHeight,
    		textLarge,
    		textSmall,
    		percent,
    		max,
    		calculate
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(11, value = $$props.value);
    		if ('info' in $$props) $$invalidate(0, info = $$props.info);
    		if ('color' in $$props) $$invalidate(1, color = $$props.color);
    		if ('thickness' in $$props) $$invalidate(12, thickness = $$props.thickness);
    		if ('newValue' in $$props) $$invalidate(3, newValue = $$props.newValue);
    		if ('radius' in $$props) $$invalidate(4, radius = $$props.radius);
    		if ('side' in $$props) side = $$props.side;
    		if ('circle' in $$props) $$invalidate(5, circle = $$props.circle);
    		if ('hidCircle' in $$props) $$invalidate(6, hidCircle = $$props.hidCircle);
    		if ('rootEle' in $$props) $$invalidate(7, rootEle = $$props.rootEle);
    		if ('rootWidth' in $$props) $$invalidate(2, rootWidth = $$props.rootWidth);
    		if ('rootHeight' in $$props) $$invalidate(21, rootHeight = $$props.rootHeight);
    		if ('textLarge' in $$props) $$invalidate(8, textLarge = $$props.textLarge);
    		if ('textSmall' in $$props) $$invalidate(9, textSmall = $$props.textSmall);
    		if ('percent' in $$props) $$invalidate(10, percent = $$props.percent);
    		if ('max' in $$props) max = $$props.max;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*value, rootWidth*/ 2052) {
    			calculate();
    		}
    	};

    	return [
    		info,
    		color,
    		rootWidth,
    		newValue,
    		radius,
    		circle,
    		hidCircle,
    		rootEle,
    		textLarge,
    		textSmall,
    		percent,
    		value,
    		thickness,
    		circle0_binding,
    		circle1_binding,
    		b0_binding,
    		b1_binding,
    		div_binding,
    		section_elementresize_handler,
    		section_binding
    	];
    }

    class Circularbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			value: 11,
    			info: 0,
    			color: 1,
    			thickness: 12
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Circularbar",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get value() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get info() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set info(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get thickness() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set thickness(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.55.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let br0;
    	let br1;
    	let br2;
    	let t4;
    	let div2;
    	let div0;
    	let circularbar0;
    	let updating_value;
    	let t5;
    	let p1;
    	let button;
    	let t7;
    	let div1;
    	let circularbar1;
    	let updating_value_1;
    	let t8;
    	let p2;
    	let input;
    	let t9;
    	let aside;
    	let br3;
    	let t10;
    	let p3;
    	let t12;
    	let br4;
    	let br5;
    	let current;
    	let mounted;
    	let dispose;

    	function circularbar0_value_binding(value) {
    		/*circularbar0_value_binding*/ ctx[3](value);
    	}

    	let circularbar0_props = { info: 'Click below\nfor value' };

    	if (/*value*/ ctx[0] !== void 0) {
    		circularbar0_props.value = /*value*/ ctx[0];
    	}

    	circularbar0 = new Circularbar({
    			props: circularbar0_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(circularbar0, 'value', circularbar0_value_binding, /*value*/ ctx[0]));

    	function circularbar1_value_binding(value) {
    		/*circularbar1_value_binding*/ ctx[4](value);
    	}

    	let circularbar1_props = {
    		info: "Enter value below",
    		color: "#1cda81"
    	};

    	if (/*value2*/ ctx[1] !== void 0) {
    		circularbar1_props.value = /*value2*/ ctx[1];
    	}

    	circularbar1 = new Circularbar({
    			props: circularbar1_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(circularbar1, 'value', circularbar1_value_binding, /*value2*/ ctx[1]));

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Circle Bar";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "A Svelte component that emulates a circular percent based progress bar";
    			t3 = space();
    			br0 = element("br");
    			br1 = element("br");
    			br2 = element("br");
    			t4 = space();
    			div2 = element("div");
    			div0 = element("div");
    			create_component(circularbar0.$$.fragment);
    			t5 = space();
    			p1 = element("p");
    			button = element("button");
    			button.textContent = "Generate";
    			t7 = space();
    			div1 = element("div");
    			create_component(circularbar1.$$.fragment);
    			t8 = space();
    			p2 = element("p");
    			input = element("input");
    			t9 = space();
    			aside = element("aside");
    			br3 = element("br");
    			t10 = space();
    			p3 = element("p");
    			p3.textContent = "Change the viewport size to see how the bars adapt";
    			t12 = space();
    			br4 = element("br");
    			br5 = element("br");
    			attr_dev(h1, "class", "svelte-3g9b2c");
    			add_location(h1, file, 13, 1, 274);
    			attr_dev(p0, "class", "svelte-3g9b2c");
    			add_location(p0, file, 14, 1, 295);
    			add_location(br0, file, 15, 4, 377);
    			add_location(br1, file, 15, 8, 381);
    			add_location(br2, file, 15, 12, 385);
    			add_location(button, file, 21, 16, 532);
    			attr_dev(p1, "class", "svelte-3g9b2c");
    			add_location(p1, file, 20, 12, 512);
    			attr_dev(div0, "class", "svelte-3g9b2c");
    			add_location(div0, file, 18, 8, 409);
    			attr_dev(input, "type", "number");
    			set_style(input, "background", "transparent");
    			set_style(input, "width", "80px");
    			set_style(input, "color", "#eee");
    			add_location(input, file, 27, 16, 765);
    			attr_dev(p2, "class", "svelte-3g9b2c");
    			add_location(p2, file, 26, 12, 745);
    			attr_dev(div1, "class", "svelte-3g9b2c");
    			add_location(div1, file, 24, 8, 626);
    			attr_dev(div2, "class", "svelte-3g9b2c");
    			add_location(div2, file, 17, 4, 395);
    			add_location(br3, file, 32, 8, 930);
    			attr_dev(p3, "class", "svelte-3g9b2c");
    			add_location(p3, file, 33, 8, 943);
    			add_location(aside, file, 31, 4, 914);
    			add_location(br4, file, 35, 4, 1018);
    			add_location(br5, file, 35, 8, 1022);
    			attr_dev(main, "class", "svelte-3g9b2c");
    			add_location(main, file, 12, 0, 266);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, br0);
    			append_dev(main, br1);
    			append_dev(main, br2);
    			append_dev(main, t4);
    			append_dev(main, div2);
    			append_dev(div2, div0);
    			mount_component(circularbar0, div0, null);
    			append_dev(div0, t5);
    			append_dev(div0, p1);
    			append_dev(p1, button);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			mount_component(circularbar1, div1, null);
    			append_dev(div1, t8);
    			append_dev(div1, p2);
    			append_dev(p2, input);
    			set_input_value(input, /*value2*/ ctx[1]);
    			append_dev(main, t9);
    			append_dev(main, aside);
    			append_dev(aside, br3);
    			append_dev(aside, t10);
    			append_dev(aside, p3);
    			append_dev(main, t12);
    			append_dev(main, br4);
    			append_dev(main, br5);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*spin*/ ctx[2], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const circularbar0_changes = {};

    			if (!updating_value && dirty & /*value*/ 1) {
    				updating_value = true;
    				circularbar0_changes.value = /*value*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			circularbar0.$set(circularbar0_changes);
    			const circularbar1_changes = {};

    			if (!updating_value_1 && dirty & /*value2*/ 2) {
    				updating_value_1 = true;
    				circularbar1_changes.value = /*value2*/ ctx[1];
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			circularbar1.$set(circularbar1_changes);

    			if (dirty & /*value2*/ 2 && to_number(input.value) !== /*value2*/ ctx[1]) {
    				set_input_value(input, /*value2*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(circularbar0.$$.fragment, local);
    			transition_in(circularbar1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(circularbar0.$$.fragment, local);
    			transition_out(circularbar1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(circularbar0);
    			destroy_component(circularbar1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let value = 51;
    	let value2 = 13;
    	let range = 400;

    	function spin() {
    		$$invalidate(0, value = Math.floor(Math.random() * 100) + 1);
    	} //value2 = Math.floor(Math.random() * 100) + 1;

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function circularbar0_value_binding(value$1) {
    		value = value$1;
    		$$invalidate(0, value);
    	}

    	function circularbar1_value_binding(value) {
    		value2 = value;
    		$$invalidate(1, value2);
    	}

    	function input_input_handler() {
    		value2 = to_number(this.value);
    		$$invalidate(1, value2);
    	}

    	$$self.$capture_state = () => ({ Circularbar, value, value2, range, spin });

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('value2' in $$props) $$invalidate(1, value2 = $$props.value2);
    		if ('range' in $$props) range = $$props.range;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		value,
    		value2,
    		spin,
    		circularbar0_value_binding,
    		circularbar1_value_binding,
    		input_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
