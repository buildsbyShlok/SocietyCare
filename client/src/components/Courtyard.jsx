import { useRef, useEffect } from "react";
import "./Courtyard.css";
import { createSocietyCamera } from "./society-camera";

// Decorative three-tower architecture; geometry does not represent recorded inventory.
const TOWERS = [
  { x: -156, z: -90, height: 218, wall: "#e4c3a4", shade: "#aa8168", roof: "#f2d8be" },
  { x: 0, z: -132, height: 274, wall: "#c0d1db", shade: "#8298ac", roof: "#e0e8ec" },
  { x: 156, z: -90, height: 238, wall: "#c4d1b6", shade: "#869b7c", roof: "#e1e8d6" },
];
const TREES = [[-252,-155],[-252,-54],[-249,56],[-205,175],[252,-155],[252,-45],[246,66],[204,175],[-68,100],[70,100]];

function Solid({ width, height, depth, color, className = "", bottom = 0 }) {
  return <div className={"model-solid " + className} style={{
    "--w": width + "px", "--h": height + "px", "--d": depth + "px", "--solid-color": color, bottom
  }}>
    {["front", "back", "left", "right", "top"].map(face => <i key={face} className={"solid-" + face} />)}
  </div>;
}
function Prop({ x, z, children, className = "" }) {
  return <div className={"model-prop " + className} style={{ "--x": x + "px", "--z": z + "px" }}>{children}</div>;
}
function Tree({ x, z, index }) {
  return <Prop x={x} z={z} className="model-tree">
    <div className="prop-shadow" />
    <Solid width={5} height={28} depth={5} color="#7a6247" />
    <div className="tree-canopy" style={{ animationDelay: -(index % 4) + "s" }}>
      {[0, 60, 120].map(angle => <i key={angle} style={{ transform: "rotateY(" + angle + "deg)" }} />)}
    </div>
  </Prop>;
}
export default function Courtyard() {
  const viewport = useRef(null);
  const camera = useRef(null);
  if (!camera.current) camera.current = createSocietyCamera(({yaw,pitch}) => {
    viewport.current?.style.setProperty("--camera-yaw",yaw+"deg");
    viewport.current?.style.setProperty("--camera-pitch",pitch+"deg");
  });
  useEffect(()=>{
    const element=viewport.current;
    const fit=width=>element.style.setProperty("--scene-fit",String(Math.min(width*.96,1240)/780));
    fit(element.clientWidth);
    const resize=new ResizeObserver(entries=>fit(entries[0].contentRect.width));
    resize.observe(element);
    const cancel=()=>camera.current.cancel();
    window.addEventListener("blur",cancel);
    document.addEventListener("visibilitychange",cancel);
    return ()=>{
      cancel();
      resize.disconnect();
      window.removeEventListener("blur",cancel);
      document.removeEventListener("visibilitychange",cancel);
    };
  },[]);
  function pointerDown(e) {
    if (!camera.current.down(e)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  return <section className="society-model" aria-label="Illustrative residential society">
    <div className="model-viewport" ref={viewport} role="img" aria-label="Three residential towers, landscaped gardens, roads and community spaces"
      onPointerDown={pointerDown} onPointerMove={e=>camera.current.move(e)}
      onPointerUp={e=>camera.current.up(e)} onPointerCancel={e=>camera.current.up(e)}
      onLostPointerCapture={e=>camera.current.up(e)}>
      <div className="model-scale"><div className="model-camera"><div className="model-orbit" aria-hidden="true">
        <div className="model-ground">
          <div className="model-road" /><div className="model-entry-road" />
          <div className="model-garden garden-west" /><div className="model-garden garden-east" />
          <div className="model-walking-path" /><div className="model-parking" />
          <div className="model-court"><i /><b /></div>
          <div className="model-plaza" />
        </div>
        {TOWERS.map((tower, i) => <div className="model-building" key={i} style={{
          "--tower-x": tower.x+"px", "--tower-z": tower.z+"px", "--tower-height": tower.height+"px",
          "--model-wall": tower.wall, "--model-side": tower.shade, "--model-roof": tower.roof
        }}>
          <div className="tower-shadow" />
          {["front","back","left","right"].map(face => <div key={face} className={"model-face model-"+face}>
            <div className="model-windows">{Array.from({length:24},(_,j)=><i key={j}/>)}</div>
            {(face==="front" || face==="back") && Array.from({length:8},(_,j)=>
              <div key={j} className="model-balcony" style={{top: (j*10.5+7)+"%"}} />)}
            <div className="model-lobby" />
          </div>)}
          <div className="model-roof"><div className="model-solar" /></div>
          <div className="model-rooftop"><Solid width={24} height={12} depth={22} color={tower.shade}/></div>
        </div>)}
        {TREES.map(([x,z],i)=><Tree key={i} x={x} z={z} index={i}/>)}
        {[-1,1].map(side=><Prop key={side} x={side*230} z={-205} className="model-hedge">
          <Solid width={110} height={12} depth={16} color="#76956b"/>
        </Prop>)}
        {[-170,-124,-78].map((x,i)=><Prop key={x} x={x} z={122} className="model-car">
          <div className="prop-shadow" />
          <Solid width={21} height={10} depth={39} color={["#bd7159","#d5dadd","#607e99"][i]} bottom={4}/>
          <Solid width={18} height={9} depth={20} color="#334c5b" bottom={14}/>
          <i className="car-wheel wheel-left" /><i className="car-wheel wheel-right" />
        </Prop>)}
        <div className="model-moving-vehicle">
          <div className="prop-shadow" />
          <Solid width={23} height={13} depth={38} color="#c59768" bottom={4}/>
          <Solid width={20} height={11} depth={22} color="#47616e" bottom={17}/>
        </div>
        <Prop x={83} z={181} className="model-security">
          <Solid width={36} height={33} depth={30} color="#d6c9b0" />
          <Solid width={43} height={5} depth={37} color="#607785" bottom={33}/>
          <span className="security-window" />
        </Prop>
        {[-42,42].map(x=><Prop key={x} x={x} z={198} className="model-gate">
          <Solid width={8} height={46} depth={9} color="#9eaaaf"/>
        </Prop>)}
        <Prop x={0} z={198} className="model-gate">
          <Solid width={92} height={7} depth={12} color="#5d7380" bottom={42}/>
          <div className="gate-barrier"/>
        </Prop>
        {[-31,31].map(x=><Prop key={x} x={x} z={55} className="model-bench">
          <Solid width={25} height={4} depth={10} color="#af8860" bottom={9}/>
          <Solid width={21} height={9} depth={5} color="#71816b"/>
        </Prop>)}
        <Prop x={145} z={111} className="model-recreation">
          <Solid width={4} height={30} depth={4} color="#d5d8d5"/>
          <span className="court-backboard"/><i className="court-hoop"/>
        </Prop>
        {[-212,212].map(x=><Prop key={x} x={x} z={30} className="model-lamp">
          <Solid width={3} height={46} depth={3} color="#6c7981"/>
          <span/>
        </Prop>)}
      </div></div></div>
    </div>
  </section>;
}
