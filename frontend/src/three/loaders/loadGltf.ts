import { type AnimationClip, type Group, PropertyBinding } from 'three'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Carregamento do modelo 3D no formato interno do runtime web, GLB/glTF 2.0 (ADR-008; doc-fonte
// § 12). O loader só entrega a cena do asset: ele não lê geometria de cálculo nem capacidade do
// arquivo (RN-003; ADR-013 C-4, regra 1). O mapeamento dos nós para o `CraneController` fica em
// `../crane/craneKinematics.ts`.

/** Motivo da falha ao carregar um GLB/glTF. */
export type GltfLoadErrorCode =
  /** A requisição nem chegou a uma resposta (rede fora, CORS, URL inacessível). */
  | 'network-error'
  /** O servidor respondeu com status HTTP de erro (por exemplo, 404). */
  | 'http-error'
  /** O conteúdo não é um glTF 2.0 válido (JSON quebrado, GLB corrompido, versão < 2.0, sem cena). */
  | 'invalid-file'

/** Erro com causa classificada, para a UI dizer o que aconteceu sem expor exceção genérica. */
export class GltfLoadError extends Error {
  readonly code: GltfLoadErrorCode
  /** URL pedida, quando o carregamento foi por URL. */
  readonly url?: string
  /** Status HTTP, quando `code` é `http-error`. */
  readonly status?: number

  constructor(
    code: GltfLoadErrorCode,
    message: string,
    details: { url?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: details.cause })
    this.name = 'GltfLoadError'
    this.code = code
    this.url = details.url
    this.status = details.status
  }
}

/** Metadados do bloco `asset` do glTF (versão da especificação, ferramenta geradora e extras). */
export interface GltfAssetInfo {
  readonly version: string
  readonly generator?: string
  readonly copyright?: string
  readonly extras?: unknown
}

/** Resultado de um carregamento bem-sucedido. */
export interface LoadedGltf {
  /** Cena padrão do asset, com a hierarquia de nós como veio do arquivo. */
  readonly scene: Group
  readonly animations: readonly AnimationClip[]
  readonly asset: GltfAssetInfo
  /**
   * Nomes dos nós como estão no arquivo (`nodes[].name`), já saneados como o GLTFLoader faz
   * (`PropertyBinding.sanitizeNodeName`). O GLTFLoader renomeia nós repetidos na cena (`nome_1`); esta
   * lista preserva as repetições, para o mapeamento cinemático denunciar nomes duplicados.
   */
  readonly sourceNodeNames: readonly string[]
}

export interface ParseGltfOptions {
  /** Base para resolver recursos externos de um .gltf (buffers e texturas em arquivos separados). */
  readonly resourcePath?: string
}

export interface LoadGltfOptions {
  /** `fetch` a usar (injeção para testes). Padrão: `globalThis.fetch`. */
  readonly fetch?: typeof fetch
  readonly signal?: AbortSignal
}

/**
 * Interpreta um GLB (ArrayBuffer) ou um .gltf (texto JSON) já em memória. Rejeita com `GltfLoadError`
 * de código `invalid-file` se o conteúdo não for um glTF 2.0 com cena.
 */
export async function parseGltf(
  data: ArrayBuffer | string,
  options: ParseGltfOptions = {},
): Promise<LoadedGltf> {
  const loader = new GLTFLoader()
  let gltf: GLTF
  try {
    // `GLTFLoader.parse` lança alguns erros de forma síncrona (JSON inválido) e outros pelo callback.
    gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(data, options.resourcePath ?? '', resolve, reject)
    })
  } catch (cause) {
    throw new GltfLoadError('invalid-file', `Arquivo GLB/glTF inválido: ${describe(cause)}`, {
      cause,
    })
  }
  if (!gltf.scene) {
    throw new GltfLoadError('invalid-file', 'Arquivo GLB/glTF inválido: o asset não tem cena.')
  }
  const json = gltf.parser.json as {
    asset?: { version?: string; generator?: string; copyright?: string; extras?: unknown }
    nodes?: { name?: string }[]
  }
  return {
    scene: gltf.scene,
    animations: gltf.animations,
    asset: {
      version: json.asset?.version ?? '',
      generator: json.asset?.generator,
      copyright: json.asset?.copyright,
      extras: json.asset?.extras,
    },
    sourceNodeNames: (json.nodes ?? []).map((node) =>
      PropertyBinding.sanitizeNodeName(node.name ?? ''),
    ),
  }
}

/**
 * Baixa e interpreta um GLB/glTF. Distingue falha de rede (`network-error`), resposta HTTP de erro
 * (`http-error`) e arquivo inválido (`invalid-file`).
 */
export async function loadGltf(url: string, options: LoadGltfOptions = {}): Promise<LoadedGltf> {
  const doFetch = options.fetch ?? globalThis.fetch
  let response: Response
  try {
    response = await doFetch(url, { signal: options.signal })
  } catch (cause) {
    throw new GltfLoadError(
      'network-error',
      `Falha de rede ao baixar o modelo 3D (${url}): ${describe(cause)}`,
      { url, cause },
    )
  }
  if (!response.ok) {
    throw new GltfLoadError(
      'http-error',
      `O servidor respondeu ${response.status} ao baixar o modelo 3D (${url}).`,
      { url, status: response.status },
    )
  }
  let data: ArrayBuffer
  try {
    data = await response.arrayBuffer()
  } catch (cause) {
    throw new GltfLoadError(
      'network-error',
      `Falha de rede ao ler o modelo 3D (${url}): ${describe(cause)}`,
      { url, cause },
    )
  }
  try {
    return await parseGltf(data, { resourcePath: resourcePathOf(url) })
  } catch (error) {
    if (error instanceof GltfLoadError) {
      throw new GltfLoadError(error.code, `${error.message} (${url})`, { url, cause: error.cause })
    }
    throw error
  }
}

function resourcePathOf(url: string): string {
  const slash = url.lastIndexOf('/')
  return slash >= 0 ? url.slice(0, slash + 1) : ''
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
