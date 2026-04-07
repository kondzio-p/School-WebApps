import { useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
	OrbitControls,
	Edges,
	PerspectiveCamera,
	Environment,
	ContactShadows,
	Html,
} from "@react-three/drei";

// interfejsy - co tu w ogole jest grane
interface Item {
	id: string;
	name?: string;
	w: number;
	h: number;
	d: number;
	weight: number;
	stackingMode?: "standard" | "nonStackable" | "bottomOnly";
}

// bazy gotowców
const VEHICLES = [
	{
		name: "Naczepa 13.6m",
		width: 2.4,
		height: 2.6,
		depth: 13.6,
		maxWeight: 24000,
	},
	{
		name: "Kontener 40ft",
		width: 2.35,
		height: 2.39,
		depth: 12.03,
		maxWeight: 28800,
	},
	{
		name: "Kontener 20ft",
		width: 2.35,
		height: 2.39,
		depth: 5.9,
		maxWeight: 28200,
	},
	{
		name: "Bus blaszak",
		width: 1.7,
		height: 1.9,
		depth: 3.3,
		maxWeight: 1500,
	},
];

const PALLETS = [
	{
		name: "Europaleta 120x80",
		w: 0.8,
		d: 1.2,
		h: 1.5,
		weight: 500,
		stackingMode: "standard" as const,
	},
	{
		name: "Przemysłowa 120x100",
		w: 1.0,
		d: 1.2,
		h: 1.5,
		weight: 600,
		stackingMode: "standard" as const,
	},
	{
		name: "Krucha/niepiętrowalna",
		w: 0.8,
		d: 1.2,
		h: 1.0,
		weight: 300,
		stackingMode: "nonStackable" as const,
	},
	{
		name: "Karton (standard)",
		w: 0.4,
		d: 0.4,
		h: 0.4,
		weight: 20,
		stackingMode: "standard" as const,
	},
];

interface PlacedPackage extends Item {
	color: string;
	position: [number, number, number];
	// wymiary jak go juz obrocisz
	actualW: number;
	actualH: number;
	actualD: number;
}

interface ContainerDims {
	width: number;
	height: number;
	depth: number;
	maxWeight: number;
}

// klocki 3d - pojedyncza paka na scenie, teraz z podpisem
const PlacedBox = ({
	pkg,
	showLabel = true,
}: {
	pkg: PlacedPackage;
	showLabel?: boolean;
}) => (
	<mesh
		position={[
			pkg.position[0] + pkg.actualW / 2,
			pkg.position[1] + pkg.actualH / 2,
			pkg.position[2] + pkg.actualD / 2,
		]}
	>
		<boxGeometry args={[pkg.actualW, pkg.actualH, pkg.actualD]} />
		<meshStandardMaterial
			color={pkg.color}
			opacity={0.85}
			transparent
			metalness={0.2}
			roughness={0.3}
		/>
		<Edges
			color={
				pkg.stackingMode === "nonStackable"
					? "red"
					: pkg.stackingMode === "bottomOnly"
						? "blue"
						: "white"
			}
			threshold={15}
		/>
		{/* labelka z nazwa - zeby wiedziec co jest co */}
		{pkg.name && showLabel && (
			<Html center distanceFactor={4} style={{ pointerEvents: "none" }}>
				<div
					style={{
						background: "rgba(0,0,0,0.75)",
						color: "#fff",
						padding: "2px 6px",
						borderRadius: "4px",
						fontSize: "10px",
						fontWeight: "bold",
						whiteSpace: "nowrap",
						fontFamily: "monospace",
						border: "1px solid rgba(255,255,255,0.2)",
						textShadow: "0 1px 2px rgba(0,0,0,0.5)",
					}}
				>
					{pkg.name}
				</div>
			</Html>
		)}
	</mesh>
);

export default function App() {
	// wymiary naczepy, paki i błędy
	const [container, setContainer] = useState<ContainerDims>({
		width: 2.4,
		height: 2.6,
		depth: 6.0,
		maxWeight: 24000,
	});

	const [itemsToPack, setItemsToPack] = useState<Item[]>([]);
	const [placedPackages, setPlacedPackages] = useState<PlacedPackage[]>([]);
	const [error, setError] = useState<string | null>(null);

	// sidebar i ukrywanie
	const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
	const [hiddenPackageIds, setHiddenPackageIds] = useState<string[]>([]);
	const [showLabels, setShowLabels] = useState(true);

	// nowa paka z formularza
	const [newPkg, setNewPkg] = useState<{
		name: string;
		w: number;
		h: number;
		d: number;
		weight: number;
		stackingMode: "standard" | "nonStackable" | "bottomOnly";
	}>({
		name: "Własna paczka",
		w: 0.8,
		h: 1.2,
		d: 1.2,
		weight: 450,
		stackingMode: "standard",
	});

	// magia pakowania i krecenia paka
	const calculateLayout = (items: Item[]) => {
		// najpierw wielkie krowy na tył
		const sortedItems = [...items].sort(
			(a, b) => b.w * b.h * b.d - a.w * a.h * a.d,
		);

		const result: PlacedPackage[] = [];
		const step = 0.1;

		for (const item of sortedItems) {
			let foundPos: [number, number, number] | null = null;
			let bestOrientation: { w: number; h: number; d: number } | null =
				null;

			// krecimy paka na wszystkie strony (6 orientacji - bo szescian ma 6 scian)
			const orientations = [
				{ w: item.w, h: item.h, d: item.d },
				{ w: item.d, h: item.h, d: item.w },
				{ w: item.w, h: item.d, d: item.h },
				{ w: item.h, h: item.w, d: item.d },
				{ w: item.d, h: item.w, d: item.h },
				{ w: item.h, h: item.d, d: item.w },
			];

			// wazne: kładziemy na płasko, zeby wysokie nie zawadzaly
			orientations.sort((a, b) => a.h - b.h);

			outerLoop: for (let z = 0; z <= container.depth - 0.1; z += step) {
				for (let y = 0; y <= container.height - 0.1; y += step) {
					for (let x = 0; x <= container.width - 0.1; x += step) {
						for (const orient of orientations) {
							if (
								x + orient.w <= container.width + 0.001 &&
								y + orient.h <= container.height + 0.001 &&
								z + orient.d <= container.depth + 0.001
							) {
								// opcja: ma leżeć twardo na glebie
								if (
									item.stackingMode === "bottomOnly" &&
									y > 0.001
								) {
									continue;
								}

								let isColliding = false;
								let isOnNonStackable = false;

								for (const p of result) {
									const m = 0.001;

									// klasyczna kolizja
									const overlapsX =
										x < p.position[0] + p.actualW - m &&
										x + orient.w > p.position[0] + m;
									const overlapsY =
										y < p.position[1] + p.actualH - m &&
										y + orient.h > p.position[1] + m;
									const overlapsZ =
										z < p.position[2] + p.actualD - m &&
										z + orient.d > p.position[2] + m;

									if (overlapsX && overlapsY && overlapsZ) {
										isColliding = true;
										break;
									}

									// pietrowanie - czy przypadkiem nie kładziemy na czyms delikatnym?
									if (p.stackingMode === "nonStackable") {
										// czy nasza paczka wisi nad ta delikatną?
										const isAbove =
											y >= p.position[1] + p.actualH - m;
										if (isAbove && overlapsX && overlapsZ) {
											isOnNonStackable = true;
											break;
										}
									}
								}

								if (!isColliding && !isOnNonStackable) {
									// sprawdzanie stabilnosci - paczka nie moze wisiec w powietrzu
									let isStable = false;
									if (y < 0.001) {
										// na podlodze - zawsze stabilna
										isStable = true;
									} else {
										// liczymy ile % podstawy jest podparte przez paczki ponizej
										const baseArea = orient.w * orient.d;
										let supportedArea = 0;
										const m = 0.01;

										for (const p of result) {
											// gora paczki p musi byc na wysokosci y (czyli pod nasza paczka)
											if (
												Math.abs(
													p.position[1] +
														p.actualH -
														y,
												) < m
											) {
												// liczymy overlap w X i Z
												const overlapX = Math.max(
													0,
													Math.min(
														x + orient.w,
														p.position[0] +
															p.actualW,
													) -
														Math.max(
															x,
															p.position[0],
														),
												);
												const overlapZ = Math.max(
													0,
													Math.min(
														z + orient.d,
														p.position[2] +
															p.actualD,
													) -
														Math.max(
															z,
															p.position[2],
														),
												);
												supportedArea +=
													overlapX * overlapZ;
											}
										}

										// minimum 70% podstawy musi byc podparte
										isStable =
											supportedArea / baseArea >= 0.7;
									}

									if (isStable) {
										foundPos = [x, y, z];
										bestOrientation = orient;
										break outerLoop;
									}
								}
							}
						}
					}
				}
			}

			if (foundPos && bestOrientation) {
				result.push({
					...item,
					actualW: bestOrientation.w,
					actualH: bestOrientation.h,
					actualD: bestOrientation.d,
					position: foundPos,
					color: `hsl(${(result.length * 55) % 360}, 65%, 50%)`,
				});
			}
		}
		return result;
	};

	useEffect(() => {
		const newLayout = calculateLayout(itemsToPack);
		setPlacedPackages(newLayout);

		if (itemsToPack.length > 0 && newLayout.length < itemsToPack.length) {
			setError("paka nie wlezie...");
			setItemsToPack((prev) => prev.slice(0, -1));
		} else {
			setError(null);
		}
	}, [itemsToPack, container]);

	const handleAddItem = () => {
		if (
			newPkg.w <= 0 ||
			newPkg.h <= 0 ||
			newPkg.d <= 0 ||
			newPkg.weight < 0
		) {
			setError(`błąd: wymiary muszą być wyższe od 0!`);
			return;
		}

		const currentWeight = itemsToPack.reduce((s, i) => s + i.weight, 0);
		if (currentWeight + newPkg.weight > container.maxWeight) {
			setError(`przekroczono wage...`);
			return;
		}
		setItemsToPack((prev) => [
			...prev,
			{ ...newPkg, id: Math.random().toString(36).substr(2, 9) },
		]);
	};

	const totalWeight = useMemo(
		() => placedPackages.reduce((s, p) => s + p.weight, 0),
		[placedPackages],
	);
	const usedVol = useMemo(
		() =>
			placedPackages.reduce(
				(s, p) => s + p.actualW * p.actualH * p.actualD,
				0,
			),
		[placedPackages],
	);
	const containerVol = container.width * container.height * container.depth;

	return (
		<div className="flex h-screen w-screen flex-col md:flex-row bg-[#f5f5f5] text-gray-100 font-sans">
			{/* sidebar  */}
			<div className="w-full md:w-80 p-5 border-r border-white/10 overflow-y-auto bg-black/40 backdrop-blur-md z-20">
				<h1 className="text-xl font-black tracking-tighter text-blue-500 mb-1">
					CARGO
				</h1>
				<p className="text-[10px] text-gray-500 mb-6 font-mono uppercase tracking-widest">
					MASTER
				</p>

				<div className="space-y-6">
					{/* wymiary kontenera */}
					<section className="space-y-3">
						<h2 className="text-xs font-bold text-white-400 uppercase">
							Wymiary Kontenera (m)
						</h2>
						<select
							className="w-full bg-[#111] border border-white/5 p-2 rounded text-xs text-gray-300 outline-none mb-1"
							onChange={(e) => {
								if (e.target.value === "custom") return;
								const v = VEHICLES[parseInt(e.target.value)];
								setContainer({
									width: v.width,
									height: v.height,
									depth: v.depth,
									maxWeight: v.maxWeight,
								});
							}}
						>
							<option value="custom">
								-- Gotowe szablony (np. naczepa) --
							</option>
							{VEHICLES.map((v, i) => (
								<option key={i} value={i}>
									{v.name}
								</option>
							))}
						</select>
						<div className="grid grid-cols-2 gap-2">
							<div className="flex flex-col">
								<span className="text-[9px] text-white-500 pl-1 uppercase">
									Długość
								</span>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={container.depth}
									onChange={(e) =>
										setContainer({
											...container,
											depth: +e.target.value,
										})
									}
									className="bg-[#111] border border-white/5 p-2 rounded text-sm focus:border-blue-500 outline-none"
								/>
							</div>
							<div className="flex flex-col">
								<span className="text-[9px] text-white-500 pl-1 uppercase">
									Szerokość
								</span>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={container.width}
									onChange={(e) =>
										setContainer({
											...container,
											width: +e.target.value,
										})
									}
									className="bg-[#111] border border-white/5 p-2 rounded text-sm"
								/>
							</div>
							<div className="flex flex-col">
								<span className="text-[9px] text-white-500 pl-1 uppercase">
									Wysokość
								</span>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={container.height}
									onChange={(e) =>
										setContainer({
											...container,
											height: +e.target.value,
										})
									}
									className="bg-[#111] border border-white/5 p-2 rounded text-sm"
								/>
							</div>
							<div className="flex flex-col">
								<span className="text-[9px] text-white-500 pl-1 uppercase">
									Limit Wagi (kg)
								</span>
								<input
									type="number"
									min="1"
									step="1"
									value={container.maxWeight}
									onChange={(e) =>
										setContainer({
											...container,
											maxWeight: +e.target.value,
										})
									}
									className="bg-[#111] border border-blue-900/50 p-2 rounded text-sm text-blue-400"
								/>
							</div>
						</div>
					</section>

					<hr className="border-white/5" />

					{/* dodawanie nowej paki */}
					<section className="space-y-3">
						<h2 className="text-xs font-bold text-white-400 uppercase">
							Nowa Paczka
						</h2>
						<select
							className="w-full bg-[#1a1a1a] border border-white/5 p-2 rounded text-xs text-gray-300 outline-none mb-1"
							onChange={(e) => {
								if (e.target.value === "custom") return;
								const v = PALLETS[parseInt(e.target.value)];
								setNewPkg({
									name: v.name,
									w: v.w,
									h: v.h,
									d: v.d,
									weight: v.weight,
									stackingMode: v.stackingMode,
								});
							}}
						>
							<option value="custom">
								-- Gotowe szablony pak (np. paleta) --
							</option>
							{PALLETS.map((v, i) => (
								<option key={i} value={i}>
									{v.name}
								</option>
							))}
						</select>
						<div className="flex flex-col">
							<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
								Nazwa paczki
							</label>
							<input
								type="text"
								value={newPkg.name}
								onChange={(e) =>
									setNewPkg({
										...newPkg,
										name: e.target.value,
									})
								}
								placeholder="np. Paleta z elektroniką"
								className="bg-[#1a1a1a] p-2 rounded text-xs border border-white/5 text-gray-100"
							/>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<div className="flex flex-col">
								<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
									Szerokość
								</label>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={newPkg.w}
									onChange={(e) =>
										setNewPkg({
											...newPkg,
											w: +e.target.value,
										})
									}
									className="bg-[#1a1a1a] p-2 rounded text-xs border border-white/5"
								/>
							</div>
							<div className="flex flex-col">
								<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
									Wysokość
								</label>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={newPkg.h}
									onChange={(e) =>
										setNewPkg({
											...newPkg,
											h: +e.target.value,
										})
									}
									className="bg-[#1a1a1a] p-2 rounded text-xs border border-white/5"
								/>
							</div>
							<div className="flex flex-col">
								<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
									Długość
								</label>
								<input
									type="number"
									min="0.1"
									step="0.1"
									value={newPkg.d}
									onChange={(e) =>
										setNewPkg({
											...newPkg,
											d: +e.target.value,
										})
									}
									className="bg-[#1a1a1a] p-2 rounded text-xs border border-white/5"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="flex flex-col">
								<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
									Waga (kg)
								</label>
								<input
									type="number"
									min="0"
									step="1"
									value={newPkg.weight}
									onChange={(e) =>
										setNewPkg({
											...newPkg,
											weight: +e.target.value,
										})
									}
									className="bg-[#1a1a1a] p-2 rounded text-sm border border-white/5"
								/>
							</div>
							<div className="flex flex-col">
								<label className="text-[9px] text-white-500 pl-1 uppercase mb-1">
									Piętrowanie
								</label>
								<select
									value={newPkg.stackingMode}
									onChange={(e) =>
										setNewPkg({
											...newPkg,
											stackingMode: e.target.value as any,
										})
									}
									className="bg-[#1a1a1a] p-2 rounded text-xs border border-white/5 text-gray-100"
								>
									<option value="standard">Zwykłe</option>
									<option value="nonStackable">
										Niepiętrowalna
									</option>
									<option value="bottomOnly">
										Tylko na dół
									</option>
								</select>
							</div>
						</div>
						<button
							onClick={handleAddItem}
							className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded font-black text-xs uppercase transition-all active:scale-95 shadow-lg"
						>
							Dodaj pakę
						</button>
						{error && (
							<div className="p-2 bg-red-900/30 border border-red-500 text-red-200 text-[10px] rounded text-center">
								{error}
							</div>
						)}
					</section>

					{/* staty */}
					<div className="bg-[#111] p-4 rounded-lg border border-white/5 space-y-2">
						<div className="flex justify-between items-center text-xs text-gray-400">
							<span>ZAŁADOWANE:</span>{" "}
							<span className="text-gray-100 font-bold">
								{placedPackages.length} szt.
							</span>
						</div>
						<div className="flex justify-between items-center text-xs text-gray-400">
							<span>WAGA:</span>{" "}
							<span
								className={`font-bold ${totalWeight > container.maxWeight * 0.9 ? "text-orange-500" : "text-green-500"}`}
							>
								{totalWeight} kg
							</span>
						</div>
						<div className="flex justify-between items-center text-xs text-gray-400">
							<span>OBJĘTOŚĆ:</span>{" "}
							<span className="text-blue-400 font-bold">
								{((usedVol / containerVol) * 100).toFixed(1)}%
							</span>
						</div>
						<div className="w-full bg-gray-800 h-1 rounded-full mt-2 overflow-hidden">
							<div
								className="bg-blue-500 h-full transition-all duration-500"
								style={{
									width: `${(usedVol / containerVol) * 100}%`,
								}}
							></div>
						</div>
					</div>

					<button
						onClick={() => setItemsToPack([])}
						className="w-full text-white-600 hover:text-red-400 text-[10px] uppercase font-bold"
					>
						resetuj
					</button>
				</div>
			</div>

			{/* scena 3d */}
			<div className="flex-1 relative overflow-hidden">
				{/* Przycisk pokazujący listę paczek */}
				<button
					onClick={() => setIsRightSidebarOpen(true)}
					className={`absolute top-4 right-4 z-10 bg-black/60 hover:bg-black/80 backdrop-blur text-white px-4 py-3 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${isRightSidebarOpen ? "opacity-0 pointer-events-none translate-x-4" : "opacity-100 translate-x-0"}`}
				>
					Lista paczek
				</button>

				{/* Prawy Sidebar - Lista paczek */}
				<div
					className={`absolute top-0 right-0 h-full w-80 bg-black/80 backdrop-blur-xl z-20 border-l border-white/10 p-5 transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col shadow-2xl ${isRightSidebarOpen ? "translate-x-0" : "translate-x-full"}`}
				>
					<div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
						<h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">
							Lista paczek
						</h2>
						<button
							onClick={() => setIsRightSidebarOpen(false)}
							className="text-white/50 hover:text-white pb-1 px-3 text-2xl transition-colors hover:bg-white/10 rounded-md"
						>
							&times;
						</button>
					</div>

					<div className="flex flex-wrap gap-2 mb-4">
						<button
							onClick={() => setHiddenPackageIds([])}
							className="text-[10px] text-white/70 hover:text-white uppercase tracking-wider px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
						>
							Pokaż wszystkie
						</button>
						<button
							onClick={() =>
								setHiddenPackageIds(
									placedPackages.map((p) => p.id),
								)
							}
							className="text-[10px] text-white/70 hover:text-white uppercase tracking-wider px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
						>
							Ukryj wszystkie
						</button>
						<button
							onClick={() => setShowLabels((prev) => !prev)}
							className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-colors ${showLabels ? "text-blue-400 bg-blue-500/15 hover:bg-blue-500/25" : "text-white/70 bg-white/5 hover:bg-white/10"}`}
						>
							{showLabels ? "Ukryj nazwy" : "Pokaż nazwy"}
						</button>
					</div>

					<div className="flex-1 overflow-y-auto space-y-2 pr-2">
						{placedPackages.map((pkg, i) => (
							<label
								key={pkg.id}
								className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-200 ${
									hiddenPackageIds.includes(pkg.id)
										? "bg-black/50 border-white/5 hover:border-white/20 opacity-60"
										: "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 shadow-sm"
								}`}
							>
								<input
									type="checkbox"
									className="w-4 h-4 accent-blue-500 flex-shrink-0 cursor-pointer"
									checked={!hiddenPackageIds.includes(pkg.id)}
									onChange={(e) => {
										if (e.target.checked) {
											setHiddenPackageIds((prev) =>
												prev.filter(
													(id) => id !== pkg.id,
												),
											);
										} else {
											setHiddenPackageIds((prev) => [
												...prev,
												pkg.id,
											]);
										}
									}}
								/>
								<div
									className="w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] border border-white/20"
									style={{ backgroundColor: pkg.color }}
								/>
								<div className="flex flex-col flex-1 min-w-0">
									<span
										className={`text-xs font-semibold truncate ${hiddenPackageIds.includes(pkg.id) ? "text-white/50" : "text-gray-200"}`}
									>
										{pkg.name || `Paczka ${i + 1}`}
									</span>
									<span
										className={`text-[10px] truncate ${hiddenPackageIds.includes(pkg.id) ? "text-white/30" : "text-blue-200/70"} mt-0.5`}
									>
										{pkg.actualW}x{pkg.actualH}x
										{pkg.actualD}m • {pkg.weight}kg
									</span>
								</div>
							</label>
						))}
						{placedPackages.length === 0 && (
							<div className="flex flex-col items-center justify-center h-40 text-center opacity-50">
								<div className="w-12 h-12 border-2 border-dashed border-white/40 rounded-lg mb-3"></div>
								<p className="text-xs text-white uppercase tracking-widest leading-relaxed">
									Brak paczek do
									<br />
									wyświetlenia.
								</p>
							</div>
						)}
					</div>
				</div>

				<Canvas shadows>
					<PerspectiveCamera
						makeDefault
						position={[
							container.depth * 1.2,
							container.height * 1.5,
							container.depth * 1.2,
						]}
						fov={40}
					/>
					<OrbitControls maxPolarAngle={Math.PI / 2.1} makeDefault />

					<ambientLight intensity={0.4} />
					<pointLight
						position={[10, 10, 10]}
						intensity={1}
						castShadow
					/>
					<Environment preset="city" />

					{/* grupa kontenera wycentrowana */}
					<group
						position={[
							-container.width / 2,
							-container.height / 2,
							-container.depth / 2,
						]}
					>
						<mesh
							position={[
								container.width / 2,
								container.height / 2,
								container.depth / 2,
							]}
						>
							<boxGeometry
								args={[
									container.width,
									container.height,
									container.depth,
								]}
							/>
							<meshStandardMaterial
								color="#333"
								wireframe
								opacity={0.3}
								transparent
							/>
						</mesh>

						<mesh
							rotation={[-Math.PI / 2, 0, 0]}
							position={[
								container.width / 2,
								0,
								container.depth / 2,
							]}
							receiveShadow
						>
							<planeGeometry
								args={[container.width, container.depth]}
							/>
							<meshStandardMaterial color="#1a1a1a" />
						</mesh>

						{/* rendery wszystkich pak */}
						{placedPackages.map(
							(pkg) =>
								!hiddenPackageIds.includes(pkg.id) && (
									<PlacedBox
										key={pkg.id}
										pkg={pkg}
										showLabel={showLabels}
									/>
								),
						)}
					</group>

					<ContactShadows
						opacity={0.6}
						scale={25}
						blur={2}
						far={10}
						color="#000000"
					/>
				</Canvas>
			</div>
		</div>
	);
}
