import {
	GPT4CompletionResponse,
	GPT4Message,
	MessageContent,
	fetchFromOpenAi,
} from './fetchFromOpenAi'

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `Imagine you're the GPT-4 AI, assigned to support a team in their brainstorming session. \
During the session, team may plan an event which needs to be divided into different dimensions of topics in order to make it convenient to discuss.\
Your task is to generate 5 dimensions of. In each dimension, you need to list 3 subtopics related to the dimension. Each subtopics contain a heading summary and description.\
Also you need to rank the subtopics from most recommended to least recommended.\
Return the response in the provided JSON format.`

const assistantPrompt = `
The returned JSON objects should follow this format:
{
    "dimensions": [
        {
            "topic": "topic of the first dimension",
            "subtopics": [
                {
                    "heading" : "heading of the first subtopic"
                    "description": "description of the first subtopic"
                }
                {
                    "heading" : "heading of the second subtopic"
                    "description": "description of the second subtopic"
                }
                ...
            ]
        },
        {
            "topic": "topic of the second dimension",
            "subtopics": [
                {
                    "heading" : "heading of the first subtopic"
                    "description": "description of the first subtopic"
                }
                {
                    "heading" : "heading of the second subtopic"
                    "description": "description of the second subtopic"
                }
                ...
            ]
        },
		...
    ]
}

Example of the return json file if the plan is to travel to California:
{
    "dimensions": [
        {
            "topic": "Accommodation",
            "subtopics": [
                {
                    "heading" : "Book in Advance"
                    "description": "Secure accommodations well in advance to have more options and potentially lower rates."
                }
                {
                    "heading" : "Location Proximity"
                    "description": "Choose accommodations centrally located to major attractions or public transportation hubs for convenience."
                }
                ...
            ]
        },
		...
    ]
}

Note that the objects in the value list of the subtopics in each dimension are ranked. The first one should be the most recommeneded. Therefore, in the example above, "Book in Advance" is the most recommended.
`

export async function generateDimensionsForFrame (editor: Editor, srcId: string, text: string) {
	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOpenAi(editor, srcId, text)

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

		
		const parsed_res = JSON.parse(response)
		console.log('openAiResponse: ', parsed_res)

		return parsed_res.dimensions

		// populate the response shape with the html we got back from openai.
		// TODO: populate the edges between selected shapes
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape

		// TODO: create effect to hide loading edges
		throw e
	}
}

async function buildPromptForOpenAi (editor: Editor, srcId: string, text: string): Promise<GPT4Message[]> {
	// get all text within the current selection
	//const jsonInput = getShapesText(editor, srcId)

	console.log("shape text: ", text)

	// the user messages describe what the user has done and what they want to do next. they'll get
	// combined with the system prompt to tell gpt-4 what we'd like it to do.
	const userMessages: MessageContent = [
		{
			type: 'text',
			text: 'Here are several plans that need to be divided into 5 dimensions. Below is the input text of plan:',
		},
		{
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: text !== '' ? text : 'Oh, it looks like there was not any plan.',
		},
	]

	// combine the user prompt with the system prompt
	return [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userMessages },
		{ role: 'assistant', content: assistantPrompt },
	]
}

// function getShapesText (editor: Editor, srcId: string) {
// 	const allShapes = editor.getCurrentPageShapes()

// 	const json = Array.from(allShapes)
// 		.map(shape => {
// 			if (
// 				shape.type === 'node' && shape.id !== srcId
// 			) {
// 				// @ts-expect-error
// 				return { text: shape.props.text, 
// 					id: shape.id }
// 			}
// 			return { text: null, id: null }
// 		})
// 		.filter(v => v.text !== null && v.text !== '')

// 	const res = {
// 		"source_note": { id: srcId, text: editor.getShape(srcId).props.text },
// 		"target_notes": json
// 	}

// 	return JSON.stringify(res)
// }