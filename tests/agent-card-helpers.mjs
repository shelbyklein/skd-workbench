export async function chooseAgentCard(page,card,agent,model,effort='End'){
 await card.locator('[data-agent-parameter="agent"]').click();
 await card.getByRole('radio',{name:agent,exact:true}).click();
 await card.locator('[data-agent-parameter="model"]').click();
 await card.getByRole('radio',{name:model,exact:true}).click();
 await card.locator('[data-agent-parameter="effort"]').click();
 const slider=card.getByRole('slider');if(await slider.isEnabled()){await slider.focus();await page.keyboard.press(effort);}
 await card.getByRole('button',{name:'Done',exact:true}).click();
}
