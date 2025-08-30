"use client";

import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Download, Ruler, Settings2 } from "lucide-react";
import { motion } from "framer-motion";



/**
 * ACAD Block Type Creator – Simple Plate with Center Hole & Keyhole
 *
 * Features:
 * - Parametric inputs (width, thickness, outer radius, center-hole Ø, filler length, keyhole size & offset).
 * - Properties panel reflecting current values and constraints.
 * - Engineering dimensions overlay (feet–inches.decimal) or metric.
 * - Unit system toggle (in / mm) with precision.
 * - Zoom / pan (simple zoom slider) and SVG export.
 */

// ---------- helpers ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function inchesToEngineeringStr(inches, precision = 2) {
  // Engineering format: feet'-inches.decimal"
  const sign = inches < 0 ? "-" : "";
  const abs = Math.abs(inches);
  const feet = Math.floor(abs / 12);
  const inch = abs - feet * 12;
  const inc = inch.toFixed(precision);
  return `${sign}${feet}'-${inc}\"`;
}

function formatValue({ valueInInches, unit, precision }) {
  if (unit === "in") return `${valueInInches.toFixed(precision)}\"`;
  // mm display
  const mm = valueInInches * 25.4;
  return `${mm.toFixed(precision)} mm`;
}

function ensureNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- main component ----------
export default function BlockCreator() {
  // Base geometry uses *inches* internally
  const [unit, setUnit] = useState("in"); // "in" | "mm"
  const [precision, setPrecision] = useState(2);
  const [showDims, setShowDims] = useState(true);
  const [zoom, setZoom] = useState(2.5);

  const uiVal = (inches) => (unit === "in" ? inches : inches * 25.4);
  const fromUi = (val) => (unit === "in" ? val : val / 25.4);


  const [params, setParams] = useState({
    width_in: 10, // plate overall width
    thickness_in: 2.5, // vertical size of bar
    centerHoleDia_in: 2.5, // center hole diameter
  });

  const [inputVals, setInputVals] = useState({
    width_in: uiVal(params.width_in),
    thickness_in: uiVal(params.thickness_in),
    centerHoleDia_in: uiVal(params.centerHoleDia_in),
  });

  // constraints / computed
  const computed = useMemo(() => {
    const p = { ...params };
    p.width_in = clamp(p.width_in, 2, 36);
    p.thickness_in = clamp(p.thickness_in, 0.1, 10);
    p.centerHoleDia_in = clamp(p.centerHoleDia_in, 0.1, p.width_in * 0.9);

    const scale = 8; // px per inch at zoom=1
    const px = (x) => x * scale * zoom;

    const hw = p.width_in / 2; // half width
    const ht = p.thickness_in / 2; // half thickness (vertical half)

    return { p, px, hw, ht, scale };
  }, [params, zoom]);

  const svgRef = useRef(null);

  // unit conversion helpers for inputs
  
  const setParam = (key, uiValue) =>
    setParams((s) => ({ ...s, [key]: fromUi(ensureNumber(uiValue, uiVal(s[key])) ) }));

  const downloadSVG = () => {
    const node = svgRef.current;
    if (!node) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(node);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acad-block-simple.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(params, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acad-block-params.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // When params or unit changes, update inputVals
  React.useEffect(() => {
    setInputVals({
      width_in: uiVal(params.width_in),
      thickness_in: uiVal(params.thickness_in),
      centerHoleDia_in: uiVal(params.centerHoleDia_in),
    });
    // eslint-disable-next-line
  }, [params, unit]);

  const handleInputChange = (k, val) => {
    setInputVals((s) => ({ ...s, [k]: val }));
  };

  const handleInputBlur = (k, val) => {
    setParam(k, val);
  };

  // ------------- drawing helpers -------------
  function Dim({ x1, y1, x2, y2, offset = 20, text, orient = "h", rotate }) {
    // simple dimension representation with arrows
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / (len || 1);
    const uy = dy / (len || 1);
    const nx = -uy; // normal
    const ny = ux;

    const ox = x1 + nx * offset;
    const oy = y1 + ny * offset;
    const px = x2 + nx * offset;
    const py = y2 + ny * offset;

    const arrow = 10;

    return (
      <g className="text-xs" stroke="#0F0E0E" fill="none">
        {/* extension lines */}
        <line x1={x1} y1={y1} x2={ox} y2={oy} strokeWidth={0.5}/>
        <line x1={x2} y1={y2} x2={px} y2={py} strokeWidth={0.5}/>
        {/* dimension line */}
        <line x1={ox} y1={oy} x2={px} y2={py} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        {/* text */}
        <text
          x={(ox + px) / 2 + (rotate ? 14 : 0)}
          y={(oy + py) / 2 - (rotate ? 22 : 6)}
          textAnchor="middle"
          fill="#0F0E0E"
          {...(rotate ? { transform: `rotate(${rotate} ${(ox + px) / 2 + 14} ${(oy + py) / 2})` } : {})}
        >
          {text}
        </text>
      </g>
    );
  }

  // ---------- render ----------
  const { p, px, hw, ht } = computed;

  // canvas size in px
  const margin = 100;
  const widthPx = px(p.width_in) + margin * 2;
  const heightPx = px(p.thickness_in) + margin * 2;

  // geometry in *inches* (origin at plate center)
  const left = -hw;
  const right = hw;
  const top = -ht;
  const bottom = ht;

  return (
    <div className="w-full min-h-screen p-6 bg-neutral-50">
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[360px_1fr_320px] gap-6">
        {/* left: controls */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl"><Settings2 className="h-5 w-5"/> Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="geom">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="geom">Geometry</TabsTrigger>
                <TabsTrigger value="display">Display</TabsTrigger>
              </TabsList>
              <TabsContent value="geom" className="space-y-4">
                {[
                  {
                    k: "width_in",
                    label: "Width",
                    min: unit === "in" ? 6 : 152.4,      // 6 in = 152.4 mm
                    max: unit === "in" ? 36 : 915,       // 36 in = 915 mm
                    step: unit === "in" ? 0.1 : 1,
                  },
                  {
                    k: "thickness_in",
                    label: "Thickness",
                    min: unit === "in" ? 0.5 : 12.7,     // 0.5 in = 12.7 mm
                    max: unit === "in" ? 10 : 254,       // 10 in = 254 mm
                    step: unit === "in" ? 0.05 : 0.5,
                  },
                  {
                    k: "centerHoleDia_in",
                    label: "Center Hole Ø",
                    min: unit === "in" ? 0.25 : 6.35,    // 0.25 in = 6.35 mm
                    max: unit === "in"
                      ? Math.max(0.25, p.width_in * 0.9)
                      : Math.max(6.35, p.width_in * 25.4 * 0.9),
                    step: unit === "in" ? 0.05 : 0.5,
                  },
                ].map(({ k, label, min, max, step }) => {
                  const v = uiVal(p[k]);
                  return (
                    <div key={k} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={k}>{label}</Label>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {unit === "in" ? `${v.toFixed(2)}\"` : `${v.toFixed(1)} mm`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id={k}
                          type="number"
                          step={step}
                          min={min}
                          max={max}
                          value={inputVals[k]}
                          onChange={(e) => handleInputChange(k, e.target.value)}
                          onBlur={(e) => handleInputBlur(k, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleInputBlur(k, e.target.value);
                          }}
                        />
                      </div>
                      <Slider
                        value={[v]}
                        min={min}
                        max={max}
                        step={step}
                        onValueChange={(vals) => setParam(k, vals[0])}
                      />
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="display" className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><Ruler className="h-4 w-4"/> Show Dimensions</Label>
                  <Switch checked={showDims} onCheckedChange={setShowDims}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Units</Label>
                    <div className="flex gap-2">
                      <Button variant={unit==="in"?"default":"outline"} onClick={()=>setUnit("in")}>in</Button>
                      <Button variant={unit==="mm"?"default":"outline"} onClick={()=>setUnit("mm")}>mm</Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Precision</Label>
                    <Input type="number" min={0} max={4} value={precision}
                      onChange={(e)=>setPrecision(clamp(Number(e.target.value)||0,0,4))}/>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Zoom</Label>
                    <Slider value={[zoom]} min={2.5} max={5} step={0.01} onValueChange={(v)=>setZoom(v[0])}/>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={downloadSVG} className="gap-2"><Download className="h-4 w-4"/>Export SVG</Button>
                  <Button variant="outline" onClick={downloadJSON} className="gap-2"><Download className="h-4 w-4"/>Export JSON</Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* center: canvas */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Plate Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto rounded-xl bg-white border">
              <motion.svg
                ref={svgRef}
                width={widthPx}
                height={heightPx}
                viewBox={`${-widthPx/2} ${-heightPx/2} ${widthPx} ${heightPx}`}
                className="mx-auto block"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#0F0E0E" />
                  </marker>
                  <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#44444E" strokeWidth="2" />
                  </pattern>
                </defs>

               

                {/* plate */}
                <g>
                  {/* hatched ends to mimic your screenshot */}
                  <rect x={px(left)} y={px(top)} width={px(p.width_in)} height={px(p.thickness_in)} fill="url(#hatch)" opacity={0.7} />
                  <rect x={px(right) - px(p.width_in)} y={px(top)} width={px(p.width_in)} height={px(p.thickness_in)} fill="url(#hatch)" opacity={0.7} />
                  {/* Plate outline */}
                  <rect x={px(left)} y={px(top)} width={px(p.width_in)} height={px(p.thickness_in)} fill="transparent" stroke="#0F0E0E" strokeWidth={2} />

                </g>

                {/* center hole */}
                <rect x={px(-p.centerHoleDia_in/2)} y={px(top)} width={px(p.centerHoleDia_in)} height={px(p.thickness_in)} fill="#ffffff" stroke="#0F0E0E" strokeWidth={2} />

                {/* axes */}
                <line
                  x1={-widthPx}
                  y1={0}
                  x2={widthPx}
                  y2={0}
                  stroke="#94a3b8"
                  strokeDasharray="20 6 6 6 20"
                />
                <line
                  x1={0}
                  y1={-heightPx}
                  x2={0}
                  y2={heightPx}
                  stroke="#94a3b8"
                  strokeDasharray="20 6 6 6 20"
                />

                {/* dimensions */}
                {showDims && (
                  <g>
                    {/* WIDTH */}
                    <Dim x1={px(left)} y1={px(bottom)} x2={px(right)} y2={px(bottom)} offset={40} text={`WIDTH = ${unit==="in"?inchesToEngineeringStr(p.width_in, precision):formatValue({valueInInches:p.width_in, unit, precision})}`} />

                    {/* THICKNESS */}
                    <Dim x1={px(left)} y1={px(top)} x2={px(left)} y2={px(bottom)} offset={60} text={`${formatValue({valueInInches:p.thickness_in, unit, precision})}`} rotate={-90} />

                    {/* CENTER HOLE */}
                    (
                      <Dim x1={px(-p.centerHoleDia_in/2)} y1={px(top)} x2={px(p.centerHoleDia_in/2)} y2={px(top)} offset={-20} text={`⌀${formatValue({valueInInches:p.centerHoleDia_in, unit, precision})}`} />
                    )
                  </g>
                )}
              </motion.svg>
            </div>
          </CardContent>
        </Card>

        {/* right: properties */}
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Plate Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-2">
              {[
                { k: "width_in", label: "Width" },
                { k: "thickness_in", label: "Thickness" },
                { k: "centerHoleDia_in", label: "Center Hole Ø" },
              ].map(({ k, label }) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="tabular-nums text-slate-600">
                    {formatValue({ valueInInches: p[k], unit, precision })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
