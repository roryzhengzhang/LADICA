import { Editor, TLShapeId, createShapeId } from '@tldraw/tldraw'
import { ResponseShape } from '../ResponseShape/ResponseShape'
import { getSelectionAsImageDataUrl } from './getSelectionAsImageDataUrl'
import {
	GPT4CompletionResponse,
	GPT4Message,
	MessageContent,
	fetchFromOpenAi,
} from './fetchFromOpenAi'

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `Imagine you are the GPT-4 model, designed to assist a team in brainstorming sessions. Your goal is to help them explore and understand the logical relationships between various text notes. Approach each note with an analytical mindset, drawing connections, identifying patterns, and suggesting possible relationship between different pieces of information. Encourage creativity and critical thinking, guiding the team through a constructive and collaborative brainstorming process. \
Your task is to identify whether there is a conflict or an agreement between different notes and also generate a short description explaining why they are conflict or agreement. Return the text in the provided JSON format.`

const assistantPrompt = `The returned JSON objects should follow this format:
{
    "nodes": [
        {
            "id": "1",
            "text": "text of the note"
        },
        {
            ...
        }
    ],
    "relationships": [
        {
            "srcId": "src note id",
            "dstId": "dst note id",
            "relation": "conflict",
			"description": "description of why the two notes are in conflict"
        },
		{
            "srcId": "src note id",
            "dstId": "dst note id",
            "relation": "agreement",
			"description": "description of why the two notes are in agreement"
        },
        {
            ...
        }
    ]
}

Note you should use node id provided to you in the input JSON object.

`

export async function createRelationship (editor: Editor) {
	// we can't make anything real if there's nothing selected
	const selectedShapes = editor.getSelectedShapes()
	if (selectedShapes.length === 0) {
		throw new Error('First select something to make real.')
	}

	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOpenAi(editor)

	// TODO: create effect to show loading edges

	try {
		// If you're using the API key input, we preference the key from there.
		// It's okay if this is undefined—it will just mean that we'll use the
		// one in the .env file instead.
		const apiKeyFromDangerousApiKeyInput = (
			document.body.querySelector('#openai_key_risky_but_cool') as HTMLInputElement
		)?.value

		// make a request to openai. `fetchFromOpenAi` is a next.js server action,
		// so our api key is hidden.
		const openAiResponse = await fetchFromOpenAi(apiKeyFromDangerousApiKeyInput, {
			model: 'gpt-4-1106-preview',
			response_format: { type: 'json_object' },
			max_tokens: 4096,
			temperature: 0,
			messages: prompt,
		})

		if (openAiResponse.error) {
			throw new Error(openAiResponse.error.message)
		}

		const response = openAiResponse.choices[0].message.content

		console.log('openAiResponse: ', response)
		const parsed_res = JSON.parse(response)
		createArrowBetweenShapes(editor, parsed_res.relationships)

		// populate the response shape with the html we got back from openai.
		// TODO: populate the edges between selected shapes
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape

		// TODO: create effect to hide loading edges
		throw e
	}
}



// Create arrows between shapes to show the inferred relationships
async function createArrowBetweenShapes (
	editor: Editor,
	relationship: { srcId: string; dstId: string; relation: string; description: string }[]
) {
	console.log('relationship: ', relationship)

	relationship.forEach((rel: any) => {
		const srcId = rel.srcId
		const dstId = rel.dstId
		const srcShape = editor.getShape(srcId)
		const dstShape = editor.getShape(dstId)
		const relation = rel.relation  
		const description = rel.description  // change the name of the property and add one more property

		if (!srcShape || !dstShape) {
			throw new Error('Could not find shape')
		}

		const srcBounds = editor.getShapePageBounds(srcShape)!
		const dstBounds = editor.getShapePageBounds(dstShape)!

		const srcX = srcBounds.x + srcBounds.width / 2
		const srcY = srcBounds.y + srcBounds.height / 2
		const dstX = dstBounds.x + dstBounds.width / 2
		const dstY = dstBounds.y + dstBounds.height / 2

		const normalizedSrcAnchor = {
			x: 0,
			y: 0.5,
		}

		const normalizedDstAnchor = {
			x: 0,
			y: 0.5,
		}

		const newShapeId = createShapeId()
		editor.createShape({
			id: newShapeId,
			type: 'arrow',
			props: {
				start: {
					type: 'binding',
					boundShapeId: srcId,
					normalizedAnchor: normalizedSrcAnchor, 
					isExact: false,
				},
				end: {
					type: 'binding',
					boundShapeId: dstId,
					normalizedAnchor: normalizedDstAnchor,
					isExact: false,
				},
				arrowheadStart: 'none',
				arrowheadEnd: 'arrow',
				relation: relation,
				description: description,
				font: 'draw',
			},
		})
	})
}

async function buildPromptForOpenAi (editor: Editor): Promise<GPT4Message[]> {
	// get all text within the current selection
	const selectedText = getSelectionAsText(editor)

	// the user messages describe what the user has done and what they want to do next. they'll get
	// combined with the system prompt to tell gpt-4 what we'd like it to do.
	const userMessages: MessageContent = [
		{
			type: 'text',
			text: 'Here are several quick thinking notes, they are presented in a JSON format where text means the note content and id means the note id. Please create logical relationships among them and return the JSON objects that shows pair relationships.',
		},
		{
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: selectedText !== '' ? selectedText : 'Oh, it looks like there was not any note.',
		},
	]

	// combine the user prompt with the system prompt
	return [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userMessages },
		{ role: 'assistant', content: assistantPrompt },
	]
}

function populateResponseShape (
	editor: Editor,
	responseShapeId: TLShapeId,
	openAiResponse: GPT4CompletionResponse
) {
	if (openAiResponse.error) {
		throw new Error(openAiResponse.error.message)
	}

	// extract the html from the response
	const message = openAiResponse.choices[0].message.content
	const start = message.indexOf('<!DOCTYPE html>')
	const end = message.indexOf('</html>')
	const html = message.slice(start, end + '</html>'.length)

	// update the response shape we created earlier with the content
	editor.updateShape<ResponseShape>({
		id: responseShapeId,
		type: 'response',
		props: { html },
	})
}

function makeEmptyResponseShape (editor: Editor) {
	const selectionBounds = editor.getSelectionPageBounds()
	if (!selectionBounds) throw new Error('No selection bounds')

	const newShapeId = createShapeId()
	editor.createShape<ResponseShape>({
		id: newShapeId,
		type: 'response',
		x: selectionBounds.maxX + 60,
		y: selectionBounds.y,
	})

	return newShapeId
}

function getSelectionAsText (editor: Editor) {
	const selectedShapeIds = editor.getSelectedShapeIds()
	const selectedShapeDescendantIds = editor.getShapeAndDescendantIds(selectedShapeIds)

	const texts = Array.from(selectedShapeDescendantIds)
		.map(id => {
			const shape = editor.getShape(id)
			if (!shape) return null
			if (
				shape.type === 'text' ||
				shape.type === 'geo' ||
				shape.type === 'arrow' ||
				shape.type === 'note' ||
				shape.type === 'node'
			) {
				// @ts-expect-error
				return { text: shape.props.text, id: shape.id }
			}
			return { text: null, id: null }
		})
		.filter(v => v.text !== null && v.text !== '')

	return JSON.stringify(texts)
}
