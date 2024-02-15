import { Editor, TLShapeId, createShapeId } from '@tldraw/tldraw'
import { TLFrameShape } from '@tldraw/editor'
import { ResponseShape } from '../ResponseShape/ResponseShape'
import { getSelectionAsImageDataUrl } from './getSelectionAsImageDataUrl'
import {
	GPT4CompletionResponse,
	GPT4Message,
	MessageContent,
	fetchFromOpenAi,
} from './fetchFromOpenAi'

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `Imagine you are a very smart, logical, and consistent summarizer for users. You are good at summarizing relatoinship between groups of node ideas and the title, summarizing relatoinship between individual node idea and the title, and mentioning related points from all specific nodes ideas in your resulting summary. Users can then understand the relationship between the title and group of ideas or individual ideas. \
You are given the title and a list of individual ideas and groups which contain some ideas. In the input JSON object, "title" indicates the title, and "idea" indicates the list of groups (type: "new_frame") and individual ideas (type: "node"). If it is the group object, you need to look at its "children" attribute instead of "text" attribute because it contains all nodes in that group. If it is a node object, you need to look at its "text" attribute instead of "children" attribute.\
Your task is 1. You need to summarize all groups of node ideas and individual node ideas. The resulting summary should be paragraph based. For example, if there are 2 groups and 3 individual nodes, the summary should have 5 paragraphs. \
2. It is critical to use the exact text from the text attribute of ideas in your summary. This ensures readers can directly correlate summary points with their respective ideas. After summarizing, provide a matching list that connects exact phrases from your summary to the corresponding idea IDs. \
The explanation of input JSON format is below. Return the text in the provided JSON format.`

const assistantPrompt = `The input JSON format is a list of ideas that could have some logical relationships among them.

The input JSON objects of title and list of groups and ideas follow this format:
{
    "title": "the title that the groups or individual ideas need to have relationship with",
    "idea": [
        {
            "id": "id of node",
            "type": "node",
            "text": "the idea written on the node"
        },
        {
            "id": "id of frame",
            "type": "new_frame",
            "text": "the name of the group",
            "children": [
                {
                    "id": "id of the children node inside the group",
                    "text": "the idea written on the node"
                },
                {
                    "id": "id of the children node inside the group",
                    "text": "the idea written on the node"
                },
            ]
        },
        ....
    ]
}

The returned JSON objects should follow this format:
{
    "summary": "the paragraph summary, the first few paragraphs is the summary of relationship between ideas in the group and the title, and the remaining paragraphs is the summary of relationship between individual ideas and the title", 

    "referenceMatching": [
        {
            “reference”: “the exact text from the generate summary correspond to the node”,
            “node id”: “id of the node that is related to the reference text”
        },
        {
            ...
        },
        ...
    ]
}

Note you should use node id provided to you in the input JSON object.

`

export async function groupByTopic (editor: Editor, shape: TLFrameShape, title: string) {

	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOpenAi(editor, shape, title)

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
        return parsed_res
		// populate the response shape with the html we got back from openai.
		// TODO: populate the edges between selected shapes
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape

		// TODO: create effect to hide loading edges
		throw e
	}
}

async function buildPromptForOpenAi (editor: Editor, shape: TLFrameShape, title: string): Promise<GPT4Message[]> {
	const ideas = getIdeas(editor, shape)

	// the user messages describe what the user has done and what they want to do next. they'll get
	// combined with the system prompt to tell gpt-4 what we'd like it to do.
	const userMessages: MessageContent = [
		{
			type: 'text',
			text: 'The first text is the title. The second text is the list of groups and individual ideas, which are presented in a JSON format as described. Please summarize relationship between the title and groups of ideas or individual ideas into paragraphs.',
		},
        {
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: title !== '' ? title : 'Oh, it looks like there was no title.',
		},
		{
			// send the text of all selected shapes, so that GPT can use it as a reference (if anything is hard to see)
			type: 'text',
			text: ideas !== '' ? ideas : 'Oh, it looks like there was no ideas.',
		},
	]

	// combine the user prompt with the system prompt
	return [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userMessages },
		{ role: 'assistant', content: assistantPrompt },
	]
}

function getIdeas (editor: Editor, shape: TLFrameShape) {
    const children = editor.getSortedChildIdsForParent(shape.id)

	const ideas = []

	children.forEach(child => {
		const s = editor.getShape(child)
		if (s.type == 'new_frame') {
            const subChildren = editor.getSortedChildIdsForParent(s.id)
			const idea = {
                id: s.id,
                type: "new_frame",
                text: s.props.name,
                children: subChildren.map((c)=> ({id: c.id, text: c.props.text}))
            }
            ideas.push(idea)
		} else if (s.type == 'node') {
			const idea = {
                id: s.id,
                type: "node",
                text: s.props.text
            }
            ideas.push(idea)
		} else {
			console.log('Unknown shape type: ', s.type)
		}
	})

	return JSON.stringify(ideas)
}