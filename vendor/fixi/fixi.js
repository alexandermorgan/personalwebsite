(()=>{
	let send = (elt, type, detail, bub)=>elt.dispatchEvent(new CustomEvent("fx:" + type, {detail, cancelable:true, bubbles:bub !== false}))
	let attr = (elt, name)=>elt.getAttribute(name)
	let init = (elt)=>{
		elt.__fixi = async(evt)=>{
			let reqs = elt.__fixi.requests ||= new Set()
			let ac = new AbortController()
			let cfg = {
				trigger:evt,
				action:attr(elt, "fx-action"),
				target:document.querySelector(attr(elt, "fx-target")),
				swap:"outerHTML",
				drop:reqs.size,
				headers:{"FX-Request":"true"},
				abort:ac.abort.bind(ac),
				signal:ac.signal,
			}
			send(elt, "config", {cfg, requests:reqs})
			if (cfg.drop) return
			reqs.add(cfg)
			try {
				cfg.response = await fetch(cfg.action, cfg)
				cfg.text = await cfg.response.text()
				if (!send(elt, "after", {cfg})) return
			} catch(error) {
				send(elt, "error", {cfg, error})
				return
			} finally {
				reqs.delete(cfg)
			}
			cfg.target[cfg.swap] = cfg.text
			send(elt, "swapped", {cfg})
		}
		elt.__fixi.evt = attr(elt, "fx-trigger")
		elt.addEventListener(elt.__fixi.evt, elt.__fixi)
	}
	let process = (n)=>{
		if (n.matches("[fx-action]")) init(n)
	}
	document.addEventListener("DOMContentLoaded", ()=>{
		process(document.body)
	})
})()
