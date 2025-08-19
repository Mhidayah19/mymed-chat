import { Package, ArrowSquareOut } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export interface ChatMaterialInfo {
  id?: string;
  name: string;
  quantity?: string;
  category?: string;
  expiryDate?: string;
  status?: string;
}

// Typing animation CSS class
export const typingAnimationClass = `
  @keyframes typing {
    from { width: 0 }
    to { width: 100% }
  }

  @keyframes blink {
    from, to { border-color: transparent }
    50% { border-color: currentColor }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .typing-cursor {
    border-right: 2px solid;
    animation: blink 1s step-end infinite;
  }

  .typing-animation {
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    animation: typing 1.5s steps(30, end);
  }

  .fade-in {
    opacity: 0;
    animation: fadeIn 0.5s ease-out forwards;
  }

  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
  .delay-400 { animation-delay: 400ms; }
  .delay-500 { animation-delay: 500ms; }
  .delay-600 { animation-delay: 600ms; }
  .delay-700 { animation-delay: 700ms; }
  .delay-800 { animation-delay: 800ms; }
`;

export const ChatMaterialCard = ({ material }: { material: ChatMaterialInfo }) => {
  const [animationStage, setAnimationStage] = useState(0);
  const [showTypingCursor, setShowTypingCursor] = useState(true);

  // Add animation styles to head on mount
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = typingAnimationClass;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Sequential animation for material card fields
  useEffect(() => {
    if (animationStage < 5) {
      const timer = setTimeout(() => {
        setAnimationStage(prev => prev + 1);
      }, 300); // Delay between stages
      
      return () => clearTimeout(timer);
    } else {
      // Remove typing cursor after all fields are shown
      const timer = setTimeout(() => {
        setShowTypingCursor(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [animationStage]);

  // Handler for card click to navigate to material URL
  const handleCardClick = () => {
    if (material.id) {
      const baseUrl = "https://mymediset-xba-dev-eu10.launchpad.cfapps.eu10.hana.ondemand.com/site?siteId=04bd86f5-c383-41a9-966a-c97d7744a8ea#cloudmymedisetuimaterials-manage?sap-ui-app-id-hint=mymediset_cloud.mymediset.uimaterials&/Materials";
      const materialUrl = `${baseUrl}(${material.id})`;
      window.open(materialUrl, "_blank");
    }
  };

  return (
    <div 
      className="bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 shadow-sm my-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleCardClick}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Package size={16} className={`text-[rgb(0,104,120)] fade-in`} />
          <span className={`font-medium text-sm fade-in ${animationStage >= 1 ? 'typing-animation' : 'opacity-0'}`}>
            {material.name}
            {animationStage === 1 && showTypingCursor && <span className="typing-cursor">&nbsp;</span>}
          </span>
          {material.status && animationStage >= 5 && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full fade-in delay-500 ${
              material.status === 'available' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
              material.status === 'low-stock' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              material.status === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
            }`}>
              {material.status.charAt(0).toUpperCase() + material.status.slice(1)}
            </span>
          )}
          <button 
            className="ml-2 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            title="View details"
            aria-label="View material details"
          >
            <ArrowSquareOut size={16} className="text-[rgb(0,104,120)]" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          {material.quantity && (
            <div className={`flex items-center fade-in ${animationStage >= 2 ? '' : 'opacity-0'} delay-200`}>
              <span className="font-medium mr-2">Quantity:</span>
              <span>
                {material.quantity}
                {animationStage === 2 && showTypingCursor && <span className="typing-cursor">&nbsp;</span>}
              </span>
            </div>
          )}
          
          {material.category && (
            <div className={`flex items-center fade-in ${animationStage >= 3 ? '' : 'opacity-0'} delay-300`}>
              <span className="font-medium mr-2">Category:</span>
              <span>
                {material.category}
                {animationStage === 3 && showTypingCursor && <span className="typing-cursor">&nbsp;</span>}
              </span>
            </div>
          )}
          
          {material.expiryDate && (
            <div className={`flex items-center fade-in ${animationStage >= 4 ? '' : 'opacity-0'} delay-400`}>
              <span className="font-medium mr-2">Expiry Date:</span>
              <span>
                {material.expiryDate}
                {animationStage === 4 && showTypingCursor && <span className="typing-cursor">&nbsp;</span>}
              </span>
            </div>
          )}
          
          {material.id && (
            <div className={`flex items-center fade-in ${animationStage >= 5 ? '' : 'opacity-0'} delay-500`}>
              <span className="font-medium mr-2">Material ID:</span>
              <span className="font-mono">
                {material.id}
                {animationStage === 5 && showTypingCursor && <span className="typing-cursor">&nbsp;</span>}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Parsing function to extract material info from markdown text
export const parseMaterialInfo = (text: string): ChatMaterialInfo[] => {
  const materials: ChatMaterialInfo[] = [];
  
  // Pattern for complete material blocks
  const completeMaterialPattern = /```material\s+([\s\S]*?)```/g;
  // Pattern for incomplete material blocks (just started with ```material)
  const incompleteMaterialPattern = /```material\s+([\s\S]*?)$/;
  
  // Check for complete materials
  let match;
  while ((match = completeMaterialPattern.exec(text)) !== null) {
    const materialContent = match[1];
    const material = extractMaterialDetails(materialContent);
    materials.push(material);
  }
  
  // Check for incomplete material at the end of text
  const incompleteMatch = text.match(incompleteMaterialPattern);
  if (incompleteMatch && !text.endsWith("```")) {
    const incompleteContent = incompleteMatch[1];
    const material = extractMaterialDetails(incompleteContent);
    material.status = material.status || 'pending'; // Mark incomplete materials as pending
    materials.push(material);
  }
  
  return materials;
};

// Helper function to extract material details from content
const extractMaterialDetails = (content: string): ChatMaterialInfo => {
  const lines = content.trim().split('\n');
  
  const material: ChatMaterialInfo = {
    name: 'Material',
  };
  
  lines.forEach(line => {
    if (line.startsWith('name:')) material.name = line.slice(5).trim();
    else if (line.startsWith('quantity:')) material.quantity = line.slice(9).trim();
    else if (line.startsWith('category:')) material.category = line.slice(9).trim();
    else if (line.startsWith('expiryDate:')) material.expiryDate = line.slice(11).trim();
    else if (line.startsWith('status:')) material.status = line.slice(7).trim().toLowerCase();
    else if (line.startsWith('id:')) material.id = line.slice(3).trim();
  });
  
  return material;
};

// Function to detect if text contains material markdown (complete or incomplete)
export const hasMaterialMarkdown = (text: string): boolean => {
  const materialPattern = /```material\s+/;
  return materialPattern.test(text);
};

// Function to remove material markdown from text
export const removeMaterialsFromText = (text: string): string => {
  // Remove complete material blocks
  let cleaned = text.replace(/```material\s+([\s\S]*?)```/g, '');
  
  // Remove incomplete material block at the end
  cleaned = cleaned.replace(/```material\s+([\s\S]*?)$/, '');
  
  return cleaned;
}; 