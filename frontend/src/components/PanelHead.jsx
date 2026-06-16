import React from "react";
import MethodologyDrawer from "./MethodologyDrawer.jsx";

export default function PanelHead({ title, indicator, right = null }) {
  return (
    <div className="panel__head">
      <h3 className="panel__title">
        {title}
        {indicator && <MethodologyDrawer indicator={indicator} label={title} />}
      </h3>
      {right}
    </div>
  );
}
