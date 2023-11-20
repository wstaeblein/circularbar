
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
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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

    // (87:12) {#if checkable}
    function create_if_block_2(ctx) {
    	let circle_1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			circle_1 = svg_element("circle");
    			attr_dev(circle_1, "cx", /*xaxis*/ ctx[8]);
    			attr_dev(circle_1, "cy", /*radius*/ ctx[6]);
    			attr_dev(circle_1, "r", /*radiusBtn*/ ctx[7]);
    			attr_dev(circle_1, "class", "btn svelte-148ritz");
    			toggle_class(circle_1, "sel", /*checked*/ ctx[0]);
    			add_location(circle_1, file$1, 87, 16, 3392);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, circle_1, anchor);
    			/*circle_1_binding*/ ctx[23](circle_1);

    			if (!mounted) {
    				dispose = listen_dev(circle_1, "click", /*click_handler*/ ctx[24], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*xaxis*/ 256) {
    				attr_dev(circle_1, "cx", /*xaxis*/ ctx[8]);
    			}

    			if (dirty[0] & /*radius*/ 64) {
    				attr_dev(circle_1, "cy", /*radius*/ ctx[6]);
    			}

    			if (dirty[0] & /*radiusBtn*/ 128) {
    				attr_dev(circle_1, "r", /*radiusBtn*/ ctx[7]);
    			}

    			if (dirty[0] & /*checked*/ 1) {
    				toggle_class(circle_1, "sel", /*checked*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(circle_1);
    			/*circle_1_binding*/ ctx[23](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(87:12) {#if checkable}",
    		ctx
    	});

    	return block;
    }

    // (91:8) {#if !checkable}
    function create_if_block(ctx) {
    	let div;
    	let b0;
    	let t0;
    	let b1;
    	let t2;
    	let if_block = /*info*/ ctx[1] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			b0 = element("b");
    			t0 = text(/*newValue*/ ctx[5]);
    			b1 = element("b");
    			b1.textContent = "%";
    			t2 = space();
    			if (if_block) if_block.c();
    			add_location(b0, file$1, 92, 16, 3656);
    			add_location(b1, file$1, 92, 55, 3695);
    			attr_dev(div, "class", "info svelte-148ritz");
    			add_location(div, file$1, 91, 12, 3620);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, b0);
    			append_dev(b0, t0);
    			/*b0_binding*/ ctx[25](b0);
    			append_dev(div, b1);
    			/*b1_binding*/ ctx[26](b1);
    			append_dev(div, t2);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*newValue*/ 32) set_data_dev(t0, /*newValue*/ ctx[5]);

    			if (/*info*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*b0_binding*/ ctx[25](null);
    			/*b1_binding*/ ctx[26](null);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(91:8) {#if !checkable}",
    		ctx
    	});

    	return block;
    }

    // (94:16) {#if info}
    function create_if_block_1(ctx) {
    	let br;
    	let t0;
    	let div;
    	let t1;

    	const block = {
    		c: function create() {
    			br = element("br");
    			t0 = space();
    			div = element("div");
    			t1 = text(/*info*/ ctx[1]);
    			add_location(br, file$1, 94, 20, 3773);
    			attr_dev(div, "class", "svelte-148ritz");
    			add_location(div, file$1, 95, 20, 3799);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, br, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, t1);
    			/*div_binding*/ ctx[27](div);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*info*/ 2) set_data_dev(t1, /*info*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[27](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(94:16) {#if info}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let section;
    	let div;
    	let svg;
    	let circle0;
    	let circle1;
    	let t;
    	let section_resize_listener;
    	let if_block0 = /*checkable*/ ctx[3] && create_if_block_2(ctx);
    	let if_block1 = !/*checkable*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			svg = svg_element("svg");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(circle0, "cx", /*xaxis*/ ctx[8]);
    			attr_dev(circle0, "cy", /*radius*/ ctx[6]);
    			attr_dev(circle0, "r", /*radius*/ ctx[6]);
    			attr_dev(circle0, "class", "svelte-148ritz");
    			add_location(circle0, file$1, 84, 12, 3160);
    			attr_dev(circle1, "cx", /*xaxis*/ ctx[8]);
    			attr_dev(circle1, "cy", /*radius*/ ctx[6]);
    			attr_dev(circle1, "r", /*radius*/ ctx[6]);
    			attr_dev(circle1, "color", /*color*/ ctx[2]);
    			attr_dev(circle1, "class", "svelte-148ritz");
    			add_location(circle1, file$1, 85, 12, 3253);
    			attr_dev(svg, "class", "svelte-148ritz");
    			add_location(svg, file$1, 83, 8, 3141);
    			attr_dev(div, "class", "container svelte-148ritz");
    			add_location(div, file$1, 82, 4, 3108);
    			attr_dev(section, "class", "circle svelte-148ritz");
    			add_render_callback(() => /*section_elementresize_handler*/ ctx[28].call(section));
    			add_location(section, file$1, 81, 0, 3029);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, svg);
    			append_dev(svg, circle0);
    			/*circle0_binding*/ ctx[21](circle0);
    			append_dev(svg, circle1);
    			/*circle1_binding*/ ctx[22](circle1);
    			if (if_block0) if_block0.m(svg, null);
    			append_dev(div, t);
    			if (if_block1) if_block1.m(div, null);
    			section_resize_listener = add_resize_listener(section, /*section_elementresize_handler*/ ctx[28].bind(section));
    			/*section_binding*/ ctx[29](section);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*xaxis*/ 256) {
    				attr_dev(circle0, "cx", /*xaxis*/ ctx[8]);
    			}

    			if (dirty[0] & /*radius*/ 64) {
    				attr_dev(circle0, "cy", /*radius*/ ctx[6]);
    			}

    			if (dirty[0] & /*radius*/ 64) {
    				attr_dev(circle0, "r", /*radius*/ ctx[6]);
    			}

    			if (dirty[0] & /*xaxis*/ 256) {
    				attr_dev(circle1, "cx", /*xaxis*/ ctx[8]);
    			}

    			if (dirty[0] & /*radius*/ 64) {
    				attr_dev(circle1, "cy", /*radius*/ ctx[6]);
    			}

    			if (dirty[0] & /*radius*/ 64) {
    				attr_dev(circle1, "r", /*radius*/ ctx[6]);
    			}

    			if (dirty[0] & /*color*/ 4) {
    				attr_dev(circle1, "color", /*color*/ ctx[2]);
    			}

    			if (/*checkable*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(svg, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*checkable*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			/*circle0_binding*/ ctx[21](null);
    			/*circle1_binding*/ ctx[22](null);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			section_resize_listener();
    			/*section_binding*/ ctx[29](null);
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
    	let { trackColor } = $$props;
    	let { textColor } = $$props;
    	let { thickness = '5%' } = $$props;
    	let { checkable = false } = $$props;
    	let { checked = false } = $$props;
    	let { decimals = false } = $$props;
    	let newValue; // Value already validated
    	let radius, radiusBtn, xaxis, side;
    	let circle, hidCircle, btnCircle;
    	let rootEle;
    	let rootWidth, rootHeight;
    	let textLarge, textSmall, percent;
    	let max = 100;
    	let discRadius = 80;

    	function calculate() {
    		$$invalidate(5, newValue = (value > max ? max : value < 0 ? 0 : value) || 0);

    		if (circle && hidCircle) {
    			let isPercent = thickness.slice(-1) == '%';
    			let breadth = parseInt(thickness) || 5;
    			let border = isPercent ? breadth / 100 * rootWidth : breadth;

    			// Discount the stroke thickness on both sides
    			side = rootWidth;

    			$$invalidate(6, radius = (side - border * 2) / 2);
    			$$invalidate(7, radiusBtn = (radius - border) * (discRadius / 100));
    			$$invalidate(8, xaxis = radius);

    			// Colors
    			if (color) {
    				rootEle.style.setProperty('--def-circlebar-color', color);
    			}

    			if (trackColor) {
    				rootEle.style.setProperty('--def-circlebar-track', trackColor);
    			}

    			if (textColor) {
    				rootEle.style.setProperty('--def-circlebar-text', textColor);
    			}

    			// Bar graph
    			let dashValue = Math.round(2 * Math.PI * radius);

    			$$invalidate(9, circle.style.strokeDashoffset = dashValue, circle);
    			$$invalidate(9, circle.style.strokeDasharray = dashValue, circle);
    			$$invalidate(9, circle.style.strokeWidth = border, circle);
    			$$invalidate(9, circle.style.transform = `translate(${border}px, ${border}px)`, circle);
    			$$invalidate(10, hidCircle.style.strokeWidth = border, hidCircle);
    			$$invalidate(10, hidCircle.style.transform = `translate(${border}px, ${border}px)`, hidCircle);
    			$$invalidate(10, hidCircle.style.transform = `translate(${border}px, ${border}px)`, hidCircle);

    			// Position toggle button
    			if (checkable) {
    				$$invalidate(11, btnCircle.style.transform = `translate(${border}px, ${border}px)`, btnCircle);
    			}

    			// Decimals
    			if (decimals) {
    				$$invalidate(5, newValue = Math.round((newValue + Number.EPSILON) * 100) / 100);
    			} else {
    				$$invalidate(5, newValue = Math.round(newValue));
    			}

    			// Value for dashoffset
    			$$invalidate(9, circle.style.strokeDashoffset = dashValue - dashValue * newValue / 100, circle);

    			// Font sizes
    			if (!checkable) {
    				$$invalidate(13, textLarge.style.fontSize = Math.max(radius / 2, 12) + 'px', textLarge);

    				if (info) {
    					$$invalidate(14, textSmall.style.fontSize = Math.max(radius / 6, 6) + 'px', textSmall);
    				}

    				$$invalidate(15, percent.style.fontSize = Math.max(radius / 6, 10) + 'px', percent);
    			}
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (color === undefined && !('color' in $$props || $$self.$$.bound[$$self.$$.props['color']])) {
    			console.warn("<Circularbar> was created without expected prop 'color'");
    		}

    		if (trackColor === undefined && !('trackColor' in $$props || $$self.$$.bound[$$self.$$.props['trackColor']])) {
    			console.warn("<Circularbar> was created without expected prop 'trackColor'");
    		}

    		if (textColor === undefined && !('textColor' in $$props || $$self.$$.bound[$$self.$$.props['textColor']])) {
    			console.warn("<Circularbar> was created without expected prop 'textColor'");
    		}
    	});

    	const writable_props = [
    		'value',
    		'info',
    		'color',
    		'trackColor',
    		'textColor',
    		'thickness',
    		'checkable',
    		'checked',
    		'decimals'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Circularbar> was created with unknown prop '${key}'`);
    	});

    	function circle0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			hidCircle = $$value;
    			$$invalidate(10, hidCircle);
    		});
    	}

    	function circle1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			circle = $$value;
    			$$invalidate(9, circle);
    		});
    	}

    	function circle_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			btnCircle = $$value;
    			$$invalidate(11, btnCircle);
    		});
    	}

    	const click_handler = () => $$invalidate(0, checked = !checked);

    	function b0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			textLarge = $$value;
    			$$invalidate(13, textLarge);
    		});
    	}

    	function b1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			percent = $$value;
    			$$invalidate(15, percent);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			textSmall = $$value;
    			$$invalidate(14, textSmall);
    		});
    	}

    	function section_elementresize_handler() {
    		rootWidth = this.clientWidth;
    		$$invalidate(4, rootWidth);
    	}

    	function section_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			rootEle = $$value;
    			$$invalidate(12, rootEle);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(16, value = $$props.value);
    		if ('info' in $$props) $$invalidate(1, info = $$props.info);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('trackColor' in $$props) $$invalidate(17, trackColor = $$props.trackColor);
    		if ('textColor' in $$props) $$invalidate(18, textColor = $$props.textColor);
    		if ('thickness' in $$props) $$invalidate(19, thickness = $$props.thickness);
    		if ('checkable' in $$props) $$invalidate(3, checkable = $$props.checkable);
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    		if ('decimals' in $$props) $$invalidate(20, decimals = $$props.decimals);
    	};

    	$$self.$capture_state = () => ({
    		value,
    		info,
    		color,
    		trackColor,
    		textColor,
    		thickness,
    		checkable,
    		checked,
    		decimals,
    		newValue,
    		radius,
    		radiusBtn,
    		xaxis,
    		side,
    		circle,
    		hidCircle,
    		btnCircle,
    		rootEle,
    		rootWidth,
    		rootHeight,
    		textLarge,
    		textSmall,
    		percent,
    		max,
    		discRadius,
    		calculate
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(16, value = $$props.value);
    		if ('info' in $$props) $$invalidate(1, info = $$props.info);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('trackColor' in $$props) $$invalidate(17, trackColor = $$props.trackColor);
    		if ('textColor' in $$props) $$invalidate(18, textColor = $$props.textColor);
    		if ('thickness' in $$props) $$invalidate(19, thickness = $$props.thickness);
    		if ('checkable' in $$props) $$invalidate(3, checkable = $$props.checkable);
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    		if ('decimals' in $$props) $$invalidate(20, decimals = $$props.decimals);
    		if ('newValue' in $$props) $$invalidate(5, newValue = $$props.newValue);
    		if ('radius' in $$props) $$invalidate(6, radius = $$props.radius);
    		if ('radiusBtn' in $$props) $$invalidate(7, radiusBtn = $$props.radiusBtn);
    		if ('xaxis' in $$props) $$invalidate(8, xaxis = $$props.xaxis);
    		if ('side' in $$props) side = $$props.side;
    		if ('circle' in $$props) $$invalidate(9, circle = $$props.circle);
    		if ('hidCircle' in $$props) $$invalidate(10, hidCircle = $$props.hidCircle);
    		if ('btnCircle' in $$props) $$invalidate(11, btnCircle = $$props.btnCircle);
    		if ('rootEle' in $$props) $$invalidate(12, rootEle = $$props.rootEle);
    		if ('rootWidth' in $$props) $$invalidate(4, rootWidth = $$props.rootWidth);
    		if ('rootHeight' in $$props) $$invalidate(31, rootHeight = $$props.rootHeight);
    		if ('textLarge' in $$props) $$invalidate(13, textLarge = $$props.textLarge);
    		if ('textSmall' in $$props) $$invalidate(14, textSmall = $$props.textSmall);
    		if ('percent' in $$props) $$invalidate(15, percent = $$props.percent);
    		if ('max' in $$props) max = $$props.max;
    		if ('discRadius' in $$props) discRadius = $$props.discRadius;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*value, rootWidth*/ 65552) {
    			calculate();
    		}
    	};

    	return [
    		checked,
    		info,
    		color,
    		checkable,
    		rootWidth,
    		newValue,
    		radius,
    		radiusBtn,
    		xaxis,
    		circle,
    		hidCircle,
    		btnCircle,
    		rootEle,
    		textLarge,
    		textSmall,
    		percent,
    		value,
    		trackColor,
    		textColor,
    		thickness,
    		decimals,
    		circle0_binding,
    		circle1_binding,
    		circle_1_binding,
    		click_handler,
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

    		init(
    			this,
    			options,
    			instance$1,
    			create_fragment$1,
    			safe_not_equal,
    			{
    				value: 16,
    				info: 1,
    				color: 2,
    				trackColor: 17,
    				textColor: 18,
    				thickness: 19,
    				checkable: 3,
    				checked: 0,
    				decimals: 20
    			},
    			null,
    			[-1, -1]
    		);

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

    	get trackColor() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set trackColor(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get textColor() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set textColor(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get thickness() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set thickness(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checkable() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checkable(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checked() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checked(value) {
    		throw new Error("<Circularbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get decimals() {
    		throw new Error("<Circularbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set decimals(value) {
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
    	let t4;
    	let div6;
    	let div1;
    	let dfn0;
    	let t6;
    	let circularbar0;
    	let updating_value;
    	let t7;
    	let div0;
    	let button;
    	let t9;
    	let div3;
    	let dfn1;
    	let t11;
    	let circularbar1;
    	let updating_value_1;
    	let t12;
    	let div2;
    	let input0;
    	let t13;
    	let div5;
    	let dfn2;
    	let t15;
    	let circularbar2;
    	let updating_value_2;
    	let updating_checked;
    	let t16;
    	let div4;
    	let input1;
    	let t17;
    	let aside;
    	let br1;
    	let t18;
    	let div7;
    	let b;
    	let t19;
    	let t20_value = (/*v3Checked*/ ctx[3] ? '' : ' not') + "";
    	let t20;
    	let t21;
    	let t22;
    	let p1;
    	let t24;
    	let br2;
    	let br3;
    	let current;
    	let mounted;
    	let dispose;

    	function circularbar0_value_binding(value) {
    		/*circularbar0_value_binding*/ ctx[5](value);
    	}

    	let circularbar0_props = {
    		decimals: true,
    		info: 'Click below\nfor value'
    	};

    	if (/*value*/ ctx[0] !== void 0) {
    		circularbar0_props.value = /*value*/ ctx[0];
    	}

    	circularbar0 = new Circularbar({
    			props: circularbar0_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(circularbar0, 'value', circularbar0_value_binding, /*value*/ ctx[0]));

    	function circularbar1_value_binding(value) {
    		/*circularbar1_value_binding*/ ctx[6](value);
    	}

    	let circularbar1_props = {
    		info: "Enter value below",
    		color: "#1cda81",
    		thickness: "10%"
    	};

    	if (/*value2*/ ctx[1] !== void 0) {
    		circularbar1_props.value = /*value2*/ ctx[1];
    	}

    	circularbar1 = new Circularbar({
    			props: circularbar1_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(circularbar1, 'value', circularbar1_value_binding, /*value2*/ ctx[1]));

    	function circularbar2_value_binding(value) {
    		/*circularbar2_value_binding*/ ctx[8](value);
    	}

    	function circularbar2_checked_binding(value) {
    		/*circularbar2_checked_binding*/ ctx[9](value);
    	}

    	let circularbar2_props = {
    		checkable: true,
    		discRadius: 90,
    		color: "dodgerblue",
    		thickness: "15%"
    	};

    	if (/*value3*/ ctx[2] !== void 0) {
    		circularbar2_props.value = /*value3*/ ctx[2];
    	}

    	if (/*v3Checked*/ ctx[3] !== void 0) {
    		circularbar2_props.checked = /*v3Checked*/ ctx[3];
    	}

    	circularbar2 = new Circularbar({
    			props: circularbar2_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(circularbar2, 'value', circularbar2_value_binding, /*value3*/ ctx[2]));
    	binding_callbacks.push(() => bind(circularbar2, 'checked', circularbar2_checked_binding, /*v3Checked*/ ctx[3]));

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Circular Bar";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "A Svelte component that emulates a circular percent based progress bar";
    			t3 = space();
    			br0 = element("br");
    			t4 = space();
    			div6 = element("div");
    			div1 = element("div");
    			dfn0 = element("dfn");
    			dfn0.textContent = "1";
    			t6 = space();
    			create_component(circularbar0.$$.fragment);
    			t7 = space();
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "Generate";
    			t9 = space();
    			div3 = element("div");
    			dfn1 = element("dfn");
    			dfn1.textContent = "2";
    			t11 = space();
    			create_component(circularbar1.$$.fragment);
    			t12 = space();
    			div2 = element("div");
    			input0 = element("input");
    			t13 = space();
    			div5 = element("div");
    			dfn2 = element("dfn");
    			dfn2.textContent = "3";
    			t15 = space();
    			create_component(circularbar2.$$.fragment);
    			t16 = space();
    			div4 = element("div");
    			input1 = element("input");
    			t17 = space();
    			aside = element("aside");
    			br1 = element("br");
    			t18 = space();
    			div7 = element("div");
    			b = element("b");
    			t19 = text("Item 3 is");
    			t20 = text(t20_value);
    			t21 = text(" checked");
    			t22 = space();
    			p1 = element("p");
    			p1.textContent = "Change the viewport size to see how the bars adapt";
    			t24 = space();
    			br2 = element("br");
    			br3 = element("br");
    			attr_dev(h1, "class", "svelte-1qd4eoa");
    			add_location(h1, file, 14, 1, 278);
    			add_location(p0, file, 15, 1, 301);
    			add_location(br0, file, 16, 4, 383);
    			attr_dev(dfn0, "class", "svelte-1qd4eoa");
    			add_location(dfn0, file, 20, 12, 425);
    			add_location(button, file, 23, 16, 585);
    			attr_dev(div0, "class", "cmd svelte-1qd4eoa");
    			add_location(div0, file, 22, 12, 551);
    			attr_dev(div1, "class", "svelte-1qd4eoa");
    			add_location(div1, file, 19, 8, 407);
    			attr_dev(dfn1, "class", "svelte-1qd4eoa");
    			add_location(dfn1, file, 27, 12, 699);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "class", "svelte-1qd4eoa");
    			add_location(input0, file, 30, 16, 875);
    			attr_dev(div2, "class", "cmd svelte-1qd4eoa");
    			add_location(div2, file, 29, 12, 841);
    			attr_dev(div3, "class", "svelte-1qd4eoa");
    			add_location(div3, file, 26, 8, 681);
    			attr_dev(dfn2, "class", "svelte-1qd4eoa");
    			add_location(dfn2, file, 34, 12, 979);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "class", "svelte-1qd4eoa");
    			add_location(input1, file, 37, 16, 1195);
    			attr_dev(div4, "class", "cmd svelte-1qd4eoa");
    			add_location(div4, file, 36, 12, 1161);
    			attr_dev(div5, "class", "svelte-1qd4eoa");
    			add_location(div5, file, 33, 8, 961);
    			attr_dev(div6, "class", "svelte-1qd4eoa");
    			add_location(div6, file, 18, 4, 393);
    			add_location(br1, file, 42, 8, 1303);
    			add_location(b, file, 43, 72, 1380);
    			set_style(div7, "justify-content", "center");
    			set_style(div7, "text-transform", "uppercase");
    			attr_dev(div7, "class", "svelte-1qd4eoa");
    			add_location(div7, file, 43, 8, 1316);
    			add_location(p1, file, 44, 8, 1444);
    			add_location(aside, file, 41, 4, 1287);
    			add_location(br2, file, 46, 4, 1519);
    			add_location(br3, file, 46, 8, 1523);
    			attr_dev(main, "class", "svelte-1qd4eoa");
    			add_location(main, file, 13, 0, 270);
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
    			append_dev(main, t4);
    			append_dev(main, div6);
    			append_dev(div6, div1);
    			append_dev(div1, dfn0);
    			append_dev(div1, t6);
    			mount_component(circularbar0, div1, null);
    			append_dev(div1, t7);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div6, t9);
    			append_dev(div6, div3);
    			append_dev(div3, dfn1);
    			append_dev(div3, t11);
    			mount_component(circularbar1, div3, null);
    			append_dev(div3, t12);
    			append_dev(div3, div2);
    			append_dev(div2, input0);
    			set_input_value(input0, /*value2*/ ctx[1]);
    			append_dev(div6, t13);
    			append_dev(div6, div5);
    			append_dev(div5, dfn2);
    			append_dev(div5, t15);
    			mount_component(circularbar2, div5, null);
    			append_dev(div5, t16);
    			append_dev(div5, div4);
    			append_dev(div4, input1);
    			set_input_value(input1, /*value3*/ ctx[2]);
    			append_dev(main, t17);
    			append_dev(main, aside);
    			append_dev(aside, br1);
    			append_dev(aside, t18);
    			append_dev(aside, div7);
    			append_dev(div7, b);
    			append_dev(b, t19);
    			append_dev(b, t20);
    			append_dev(b, t21);
    			append_dev(aside, t22);
    			append_dev(aside, p1);
    			append_dev(main, t24);
    			append_dev(main, br2);
    			append_dev(main, br3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*spin*/ ctx[4], false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[10]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[10])
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

    			if (dirty & /*value2*/ 2 && to_number(input0.value) !== /*value2*/ ctx[1]) {
    				set_input_value(input0, /*value2*/ ctx[1]);
    			}

    			const circularbar2_changes = {};

    			if (!updating_value_2 && dirty & /*value3*/ 4) {
    				updating_value_2 = true;
    				circularbar2_changes.value = /*value3*/ ctx[2];
    				add_flush_callback(() => updating_value_2 = false);
    			}

    			if (!updating_checked && dirty & /*v3Checked*/ 8) {
    				updating_checked = true;
    				circularbar2_changes.checked = /*v3Checked*/ ctx[3];
    				add_flush_callback(() => updating_checked = false);
    			}

    			circularbar2.$set(circularbar2_changes);

    			if (dirty & /*value3*/ 4) {
    				set_input_value(input1, /*value3*/ ctx[2]);
    			}

    			if ((!current || dirty & /*v3Checked*/ 8) && t20_value !== (t20_value = (/*v3Checked*/ ctx[3] ? '' : ' not') + "")) set_data_dev(t20, t20_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(circularbar0.$$.fragment, local);
    			transition_in(circularbar1.$$.fragment, local);
    			transition_in(circularbar2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(circularbar0.$$.fragment, local);
    			transition_out(circularbar1.$$.fragment, local);
    			transition_out(circularbar2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(circularbar0);
    			destroy_component(circularbar1);
    			destroy_component(circularbar2);
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
    	let value = 51.53;
    	let value2 = 32;
    	let value3 = 77;
    	let v3Checked = false;
    	let range = 400;

    	function spin() {
    		$$invalidate(0, value = Math.floor(Math.random() * 100) + Math.random());
    	}

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

    	function input0_input_handler() {
    		value2 = to_number(this.value);
    		$$invalidate(1, value2);
    	}

    	function circularbar2_value_binding(value) {
    		value3 = value;
    		$$invalidate(2, value3);
    	}

    	function circularbar2_checked_binding(value) {
    		v3Checked = value;
    		$$invalidate(3, v3Checked);
    	}

    	function input1_change_input_handler() {
    		value3 = to_number(this.value);
    		$$invalidate(2, value3);
    	}

    	$$self.$capture_state = () => ({
    		Circularbar,
    		value,
    		value2,
    		value3,
    		v3Checked,
    		range,
    		spin
    	});

    	$$self.$inject_state = $$props => {
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('value2' in $$props) $$invalidate(1, value2 = $$props.value2);
    		if ('value3' in $$props) $$invalidate(2, value3 = $$props.value3);
    		if ('v3Checked' in $$props) $$invalidate(3, v3Checked = $$props.v3Checked);
    		if ('range' in $$props) range = $$props.range;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		value,
    		value2,
    		value3,
    		v3Checked,
    		spin,
    		circularbar0_value_binding,
    		circularbar1_value_binding,
    		input0_input_handler,
    		circularbar2_value_binding,
    		circularbar2_checked_binding,
    		input1_change_input_handler
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
