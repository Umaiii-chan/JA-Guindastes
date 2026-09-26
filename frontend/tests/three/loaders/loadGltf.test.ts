import { describe, expect, it, vi } from 'vitest'

import { CRANE_NODE_NAMES } from '../../../src/three/crane/createProvisionalCrane'
import { GltfLoadError, loadGltf, parseGltf } from '../../../src/three/loaders/loadGltf'
import { readExampleGlb } from '../../helpers/exampleModel'

// Modelo de exemplo FICTÍCIO (assets/example-models; ADR-012). Nenhum dado real.

function encode(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function expectLoadError(
  promise: Promise<unknown>,
  code: GltfLoadError['code'],
): Promise<GltfLoadError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(GltfLoadError)
  expect((error as GltfLoadError).code).toBe(code)
  return error as GltfLoadError
}

function fakeResponse(body: ArrayBuffer, status = 200): Response {
  return new Response(body, { status })
}

describe('parseGltf', () => {
  it('interpreta o GLB de exemplo a partir de um ArrayBuffer e devolve a cena', async () => {
    const loaded = await parseGltf(readExampleGlb())

    expect(loaded.asset.version).toBe('2.0')
    expect(loaded.asset.generator).toMatch(/GLTFExporter/)
    for (const name of Object.values(CRANE_NODE_NAMES)) {
      expect(loaded.scene.getObjectByName(name), name).toBeDefined()
    }
  })

  it('interpreta um .gltf em texto JSON', async () => {
    const loaded = await parseGltf(
      JSON.stringify({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'a b', children: [1] }, { name: 'a b' }],
      }),
    )

    // O loader saneia ("a b" → "a_b") e renomeia o repetido; a lista do arquivo guarda os dois.
    expect(loaded.scene.getObjectByName('a_b')).toBeDefined()
    expect(loaded.scene.getObjectByName('a_b_1')).toBeDefined()
    expect(loaded.sourceNodeNames).toEqual(['a_b', 'a_b'])
  })

  it.each([
    ['bytes que não são glTF', encode('isto não é um modelo 3D')],
    ['JSON sem o bloco asset', encode('{"scenes": []}')],
    ['glTF 1.0', encode('{"asset": {"version": "1.0"}}')],
    ['GLB truncado', readExampleGlb().slice(0, 40)],
    ['arquivo vazio', new ArrayBuffer(0)],
  ])('rejeita %s com erro de arquivo inválido', async (_label, data) => {
    const error = await expectLoadError(parseGltf(data), 'invalid-file')

    expect(error.message).toMatch(/^Arquivo GLB\/glTF inválido/)
  })

  it('rejeita um glTF sem cena', async () => {
    await expectLoadError(parseGltf('{"asset": {"version": "2.0"}}'), 'invalid-file')
  })
})

describe('loadGltf', () => {
  const URL = 'https://exemplo.invalid/modelos/guindaste.glb'

  it('baixa e interpreta o GLB', async () => {
    const fetchMock = vi.fn(async () => fakeResponse(readExampleGlb()))

    const loaded = await loadGltf(URL, { fetch: fetchMock })

    expect(fetchMock).toHaveBeenCalledWith(URL, expect.anything())
    expect(loaded.scene.getObjectByName(CRANE_NODE_NAMES.hook)).toBeDefined()
  })

  it('classifica a falha de rede', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    const error = await expectLoadError(loadGltf(URL, { fetch: fetchMock }), 'network-error')

    expect(error.url).toBe(URL)
    expect(error.message).toContain('fetch failed')
  })

  it('classifica a resposta HTTP de erro, com o status', async () => {
    const fetchMock = vi.fn(async () => fakeResponse(encode('não encontrado'), 404))

    const error = await expectLoadError(loadGltf(URL, { fetch: fetchMock }), 'http-error')

    expect(error.status).toBe(404)
    expect(error.url).toBe(URL)
  })

  it('classifica o conteúdo inválido e diz qual URL', async () => {
    const fetchMock = vi.fn(async () => fakeResponse(encode('<html>não é GLB</html>')))

    const error = await expectLoadError(loadGltf(URL, { fetch: fetchMock }), 'invalid-file')

    expect(error.url).toBe(URL)
    expect(error.message).toContain(URL)
  })
})
