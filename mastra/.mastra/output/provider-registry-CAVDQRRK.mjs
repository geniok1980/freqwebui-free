import { r as requireFGA, g as getAgentFGAResourceId, a as getWorkflowFGAResourceId, b as getAgentToolFGAResourceId, c as getMCPToolFGAResourceId, d as getStandaloneToolFGAResourceId, e as checkFGA, h as ModelsDevGateway, N as NetlifyGateway, j as MastraGateway, G as GatewayRegistry, F as FGADeniedError, M as MastraFGAPermissions, f as getSafeLicenseSummary, i as isDevEnvironment, v as validateLicense, P as PROVIDER_REGISTRY, k as isOfflineMode, m as modelSupportsTemperature, p as parseModelString } from './mastra.mjs';

var fgaCheckJWUQ2QGZ = /*#__PURE__*/Object.freeze({
	__proto__: null,
	FGADeniedError: FGADeniedError,
	MastraFGAPermissions: MastraFGAPermissions,
	checkFGA: checkFGA,
	getAgentFGAResourceId: getAgentFGAResourceId,
	getAgentToolFGAResourceId: getAgentToolFGAResourceId,
	getMCPToolFGAResourceId: getMCPToolFGAResourceId,
	getSafeLicenseSummary: getSafeLicenseSummary,
	getStandaloneToolFGAResourceId: getStandaloneToolFGAResourceId,
	getWorkflowFGAResourceId: getWorkflowFGAResourceId,
	isDevEnvironment: isDevEnvironment,
	requireFGA: requireFGA,
	validateLicense: validateLicense
});

var modelsDevRCNWT4MU = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ModelsDevGateway: ModelsDevGateway
});

var netlifyYV6LPT4C = /*#__PURE__*/Object.freeze({
	__proto__: null,
	NetlifyGateway: NetlifyGateway
});

var mastraIBUTUKCN = /*#__PURE__*/Object.freeze({
	__proto__: null,
	MastraGateway: MastraGateway
});

var providerRegistryCAVDQRRK = /*#__PURE__*/Object.freeze({
	__proto__: null,
	GatewayRegistry: GatewayRegistry,
	PROVIDER_REGISTRY: PROVIDER_REGISTRY,
	isOfflineMode: isOfflineMode,
	modelSupportsTemperature: modelSupportsTemperature,
	parseModelString: parseModelString
});

export { mastraIBUTUKCN as a, fgaCheckJWUQ2QGZ as f, modelsDevRCNWT4MU as m, netlifyYV6LPT4C as n, providerRegistryCAVDQRRK as p };
